import type { MailMessage } from "./types.ts";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

function creds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  }
  return { id, secret };
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: creds().id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    // offline + consent: Google solo entrega refresh_token con ambos.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const { id, secret } = creds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Google OAuth: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim(),
    );
  }
  return json as { access_token: string; refresh_token?: string };
}

export function exchangeCode(code: string, redirectUri: string) {
  return tokenRequest({
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export async function refreshAccessToken(refreshToken: string) {
  const { access_token } = await tokenRequest({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return access_token;
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status} en ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

export async function getProfileEmail(accessToken: string): Promise<string> {
  const p = await gmailGet<{ emailAddress: string }>(accessToken, "/profile");
  return p.emailAddress;
}

/** Ids de mensajes que cumplen la búsqueda (hasta ~500, más nuevos primero). */
export async function listMessageIds(
  accessToken: string,
  query: string,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ q: query, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const r = await gmailGet<{
      messages?: { id: string }[];
      nextPageToken?: string;
    }>(accessToken, `/messages?${params}`);
    ids.push(...(r.messages ?? []).map((m) => m.id));
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

type Part = {
  mimeType?: string;
  body?: { data?: string };
  headers?: { name: string; value: string }[];
  parts?: Part[];
};

function decode(data?: string): string | null {
  return data ? Buffer.from(data, "base64url").toString("utf8") : null;
}

/** Busca recursivamente la primera parte de ese mimeType. */
function findPart(part: Part, mime: string): string | null {
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data);
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return null;
}

export async function getMessage(
  accessToken: string,
  id: string,
): Promise<MailMessage> {
  const { payload } = await gmailGet<{ payload: Part }>(
    accessToken,
    `/messages/${id}?format=full`,
  );
  const header = (name: string) =>
    payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";

  return {
    id,
    from: header("from"),
    subject: header("subject"),
    html: findPart(payload, "text/html"),
    text: findPart(payload, "text/plain"),
  };
}
