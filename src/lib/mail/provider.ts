import { decryptToken } from "./crypto.ts";
import * as gmail from "./gmail.ts";
import * as outlook from "./outlook.ts";
import type { MailMessage } from "./types.ts";

export type MailProviderKey = "gmail" | "outlook";

export const PROVIDER_LABELS: Record<MailProviderKey, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
};

/**
 * 3.3.0: lo único que la sincronización necesita de un buzón. Los parsers no
 * saben de dónde vino el correo: el mismo `parseBac` sirve para los dos.
 */
export type MailProvider = {
  listMessageIds(senders: string[], since: number): Promise<string[]>;
  getMessage(id: string): Promise<MailMessage>;
  /** Refresh token nuevo si el proveedor lo rotó (Microsoft); hay que guardarlo. */
  rotatedRefreshToken: string | null;
};

export async function openProvider(conn: {
  provider?: string | null;
  refresh_token_enc: string;
}): Promise<MailProvider> {
  const refreshToken = decryptToken(conn.refresh_token_enc);

  if (conn.provider === "outlook") {
    const tokens = await outlook.refreshTokens(refreshToken);
    return {
      listMessageIds: (senders, since) => outlook.listMessageIds(tokens.access_token, senders, since),
      getMessage: (id) => outlook.getMessage(tokens.access_token, id),
      rotatedRefreshToken:
        tokens.refresh_token && tokens.refresh_token !== refreshToken ? tokens.refresh_token : null,
    };
  }

  const accessToken = await gmail.refreshAccessToken(refreshToken);
  return {
    listMessageIds: (senders, since) =>
      gmail.listMessageIds(accessToken, `from:(${senders.join(" OR ")}) after:${since}`),
    getMessage: (id) => gmail.getMessage(accessToken, id),
    rotatedRefreshToken: null,
  };
}

/**
 * Error de sincronización → texto para el usuario. Un token revocado o
 * vencido pide reconectar en vez de mostrar el error técnico.
 */
export function syncErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/invalid_grant|interaction_required|\b401\b|unauthorized/i.test(raw)) {
    return "El permiso para leer tu correo venció o se revocó. Reconecta tu correo.";
  }
  if (/Faltan (GOOGLE|MICROSOFT)_CLIENT/.test(raw)) {
    return "Faltan las credenciales del proveedor de correo en el servidor.";
  }
  return raw || "No se pudo sincronizar";
}
