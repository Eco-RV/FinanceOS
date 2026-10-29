import type { MailMessage } from "./types.ts";

/**
 * 3.3.0: Outlook personal (outlook.com / hotmail / live) por Microsoft Graph,
 * solo lectura. Mismo papel que `gmail.ts`: OAuth, listar y descargar avisos.
 * El tenant `consumers` deja fuera las cuentas de empresa (decisión de negocio).
 */
const AUTHORITY = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
export const OUTLOOK_SCOPE = "offline_access User.Read Mail.Read";
const GRAPH = "https://graph.microsoft.com/v1.0/me";
// Ids que no cambian si el correo se mueve de carpeta (dedupe estable).
const IMMUTABLE = { Prefer: 'IdType="ImmutableId"' };

function creds() {
  const id = process.env.MICROSOFT_CLIENT_ID;
  const secret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Faltan MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET");
  }
  return { id, secret };
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: creds().id,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: OUTLOOK_SCOPE,
    prompt: "select_account",
    state,
  });
  return `${AUTHORITY}/authorize?${params}`;
}

type Tokens = { access_token: string; refresh_token?: string; scope?: string };

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const { id, secret } = creds();
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      scope: OUTLOOK_SCOPE,
      ...body,
    }),
  });
  const json = (await res.json()) as Partial<Tokens> & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Microsoft OAuth: ${json.error ?? res.status} ${(json.error_description ?? "").split("\r\n")[0]}`.trim(),
    );
  }
  return json as Tokens;
}

export function exchangeCode(code: string, redirectUri: string) {
  return tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

/**
 * Microsoft puede rotar el refresh token: si devuelve uno nuevo, quien llama
 * lo guarda (`refresh_token`).
 */
export function refreshTokens(refreshToken: string) {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

class GraphError extends Error {
  readonly status: number;
  constructor(status: number, path: string) {
    super(`Outlook (Graph) ${status} en ${path.split("?")[0]}`);
    this.status = status;
  }
}

async function graphGet<T>(accessToken: string, url: string): Promise<T> {
  const full = url.startsWith("https://") ? url : `${GRAPH}${url}`;
  const res = await fetch(full, {
    headers: { Authorization: `Bearer ${accessToken}`, ...IMMUTABLE },
    cache: "no-store",
  });
  if (!res.ok) throw new GraphError(res.status, full.replace(GRAPH, ""));
  return (await res.json()) as T;
}

export async function getProfileEmail(accessToken: string): Promise<string> {
  const me = await graphGet<{ mail?: string | null; userPrincipalName?: string }>(
    accessToken,
    "/?$select=mail,userPrincipalName",
  );
  return me.mail || me.userPrincipalName || "";
}

type GraphMessage = {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  body?: { contentType?: "html" | "text"; content?: string };
};

const MAX_PAGES = 5;

/** OData: comillas simples escapadas. */
function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

async function collect(
  accessToken: string,
  filter: string,
  keep: (m: GraphMessage) => boolean,
): Promise<string[]> {
  const ids: string[] = [];
  let next: string | undefined =
    `/messages?${new URLSearchParams({ $filter: filter, $select: "id,from", $top: "100" })}`;
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const r: { value?: GraphMessage[]; "@odata.nextLink"?: string } = await graphGet(accessToken, next);
    ids.push(...(r.value ?? []).filter(keep).map((m) => m.id));
    next = r["@odata.nextLink"];
  }
  return ids;
}

/** Ids de los mensajes de esos remitentes desde `since` (segundos Unix), hasta ~500. */
export async function listMessageIds(
  accessToken: string,
  senders: string[],
  since: number,
): Promise<string[]> {
  const date = `receivedDateTime ge ${new Date(since * 1000).toISOString()}`;
  const wanted = new Set(senders.map((s) => s.toLowerCase()));
  const fromFilter = senders.map((s) => `from/emailAddress/address eq ${quote(s)}`).join(" or ");
  try {
    return await collect(accessToken, `${date} and (${fromFilter})`, () => true);
  } catch (e) {
    // Graph a veces rechaza el filtro combinado (InefficientFilter): se pide
    // solo por fecha y se filtra el remitente aquí.
    if (!(e instanceof GraphError) || e.status !== 400) throw e;
    return collect(accessToken, date, (m) =>
      wanted.has((m.from?.emailAddress?.address ?? "").toLowerCase()),
    );
  }
}

/** Mensaje de Graph → `MailMessage` (el mismo que recibe cualquier parser). */
export function toMailMessage(m: GraphMessage): MailMessage {
  const address = m.from?.emailAddress?.address ?? "";
  const name = m.from?.emailAddress?.name;
  const content = m.body?.content ?? null;
  const html = m.body?.contentType === "html";
  return {
    id: m.id,
    from: name ? `${name} <${address}>` : address,
    subject: m.subject ?? "",
    html: html ? content : null,
    text: html ? null : content,
  };
}

export async function getMessage(accessToken: string, id: string): Promise<MailMessage> {
  const m = await graphGet<GraphMessage>(
    accessToken,
    `/messages/${encodeURIComponent(id)}?$select=id,from,subject,body`,
  );
  return toMailMessage(m);
}
