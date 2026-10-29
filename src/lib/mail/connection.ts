import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptToken } from "./crypto.ts";
import type { MailProviderKey } from "./provider.ts";

/**
 * 3.3.0: una sola conexión de correo por usuario. Conectar Gmail u Outlook
 * reemplaza la anterior (los pendientes, bancos y reglas no se tocan).
 */
export async function replaceConnection(
  supabase: SupabaseClient,
  userId: string,
  conn: { provider: MailProviderKey; email: string; refreshToken: string; scopes: string | null },
): Promise<boolean> {
  const { data: previous } = await supabase
    .from("mail_connections")
    .select("*")
    .eq("user_id", userId);
  const { error: delError } = await supabase.from("mail_connections").delete().eq("user_id", userId);
  if (delError) return false;
  const { error } = await supabase.from("mail_connections").insert({
    user_id: userId,
    provider: conn.provider,
    email: conn.email,
    refresh_token_enc: encryptToken(conn.refreshToken),
    scopes: conn.scopes,
    last_synced_at: null,
  });
  // Si la nueva no se pudo guardar (p. ej. Outlook sin el SQL 3.3.0), se
  // devuelve la anterior para no dejar al usuario sin correo.
  if (error && previous?.length) await supabase.from("mail_connections").insert(previous);
  return !error;
}
