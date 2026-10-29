import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncConnection, type SyncResult } from "@/lib/mail/sync";

// Siempre dinámico: lo invoca un cron externo (GitHub Actions) con Bearer.
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const sent = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(sent);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: connections, error } = await supabase
    .from("mail_connections")
    .select("user_id, provider, refresh_token_enc, last_synced_at");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Un usuario con la conexión rota no debe frenar a los demás.
  const results: { user_id: string; result?: SyncResult; error?: string }[] = [];
  for (const conn of connections ?? []) {
    try {
      results.push({ user_id: conn.user_id, result: await syncConnection(supabase, conn) });
    } catch (e) {
      results.push({
        user_id: conn.user_id,
        error: e instanceof Error ? e.message : "error desconocido",
      });
    }
  }

  const failed = results.filter((r) => r.error).length;
  return Response.json(
    { synced: results.length - failed, failed, results },
    { status: failed > 0 && failed === results.length ? 502 : 200 },
  );
}
