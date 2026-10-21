/**
 * Buzón de comentarios (3.2.0, B1–B6): `feedback_posts`, `feedback_messages`
 * y el bucket PRIVADO `feedback` (capturas en `<user_id>/<post>-<marca>.<ext>`,
 * enlace firmado de 10 minutos). SQL en `supabase/Versionamiento/3.2.0/`.
 * RLS: el usuario ve lo suyo; el admin (`app_metadata.role`) ve todo. Sin el
 * SQL, las lecturas devuelven vacío y escribir avisa qué falta.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  InfrastructureError,
  type FeedbackMessageRecord,
  type FeedbackPostRecord,
  type FeedbackRepository,
} from "@/application";
import { isFeedbackKind, isFeedbackStatus } from "@/domain";

const BUCKET = "feedback";
const MISSING = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);
const POST_COLUMNS =
  "id, user_id, author_name, kind, title, status, attachment_path, user_activity_at, admin_activity_at, user_read_at, admin_read_at, created_at";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type PgError = { code?: string; message?: string } | null;

function missing(error: PgError): boolean {
  return Boolean(error?.code && MISSING.has(error.code));
}

function check(error: PgError, message: string): void {
  if (!error) return;
  if (missing(error)) throw new InfrastructureError("Falta correr el SQL 3.2.0 (buzón de comentarios) en Supabase");
  throw new InfrastructureError(message);
}

function toPost(row: Record<string, unknown>): FeedbackPostRecord {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    author_name: row.author_name as string,
    kind: isFeedbackKind(row.kind) ? row.kind : "experiencia",
    title: row.title as string,
    status: isFeedbackStatus(row.status) ? row.status : "recibido",
    has_attachment: Boolean(row.attachment_path),
    user_activity_at: row.user_activity_at as string,
    admin_activity_at: (row.admin_activity_at as string | null) ?? null,
    user_read_at: row.user_read_at as string,
    admin_read_at: (row.admin_read_at as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export function supabaseFeedback(supabase: SupabaseClient) {
  async function userId(): Promise<string> {
    const { data } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!sub) throw new InfrastructureError("La sesión expiró. Vuelve a iniciar sesión.");
    return sub;
  }

  async function pathOf(postId: string): Promise<string | null> {
    const { data, error } = await supabase.from("feedback_posts").select("attachment_path").eq("id", postId).maybeSingle();
    if (error) return null;
    return (data?.attachment_path as string | null) ?? null;
  }

  const feedback: FeedbackRepository = {
    async create(input) {
      const { data, error } = await supabase.from("feedback_posts").insert(input).select("id").single();
      check(error, "No se pudo publicar");
      const id = (data as { id: string }).id;
      const { error: messageError } = await supabase
        .from("feedback_messages")
        .insert({ post_id: id, body: input.body, from_admin: false });
      if (messageError) {
        await supabase.from("feedback_posts").delete().eq("id", id);
        check(messageError, "No se pudo publicar");
      }
      return { id };
    },
    async attach(postId, file) {
      const path = `${await userId()}/${postId}-${Date.now()}.${EXT[file.type] ?? "bin"}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file.bytes, { contentType: file.type });
      if (error) {
        throw new InfrastructureError(
          /bucket not found/i.test(error.message) ? "Falta correr el SQL 3.2.0 (buzón de comentarios)" : "No se pudo subir la captura",
        );
      }
      const { error: linkError } = await supabase.from("feedback_posts").update({ attachment_path: path }).eq("id", postId);
      if (linkError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw new InfrastructureError("No se pudo ligar la captura");
      }
    },
    async attachmentUrl(postId) {
      const path = await pathOf(postId);
      if (!path) return null;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
      if (error || !data) return null;
      return data.signedUrl;
    },
    async mine() {
      const { data, error } = await supabase
        .from("feedback_posts")
        .select(POST_COLUMNS)
        .eq("user_id", await userId())
        .order("user_activity_at", { ascending: false });
      if (missing(error)) return [];
      check(error, "No se pudieron leer tus publicaciones");
      return (data ?? []).map((row) => toPost(row as Record<string, unknown>));
    },
    async all() {
      const { data, error } = await supabase
        .from("feedback_posts")
        .select(POST_COLUMNS)
        .order("user_activity_at", { ascending: false })
        .limit(500);
      if (missing(error)) return [];
      check(error, "No se pudo leer la bandeja");
      return (data ?? []).map((row) => toPost(row as Record<string, unknown>));
    },
    async find(postId) {
      const { data, error } = await supabase.from("feedback_posts").select(POST_COLUMNS).eq("id", postId).maybeSingle();
      if (missing(error)) return null;
      check(error, "No se pudo leer la conversación");
      return data ? toPost(data as Record<string, unknown>) : null;
    },
    async messages(postId) {
      const { data, error } = await supabase
        .from("feedback_messages")
        .select("id, post_id, from_admin, body, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (missing(error)) return [];
      check(error, "No se pudo leer la conversación");
      return (data ?? []) as FeedbackMessageRecord[];
    },
    async reply(postId, body, fromAdmin) {
      const { error } = await supabase.from("feedback_messages").insert({ post_id: postId, body, from_admin: fromAdmin });
      check(error, "No se pudo enviar la respuesta");
    },
    async setStatus(postId, status) {
      const { error } = await supabase.from("feedback_posts").update({ status }).eq("id", postId);
      check(error, "No se pudo cambiar el estado");
    },
    async markRead(postId, side) {
      const column = side === "user" ? "user_read_at" : "admin_read_at";
      const { error } = await supabase
        .from("feedback_posts")
        .update({ [column]: new Date().toISOString() })
        .eq("id", postId);
      check(error, "No se pudo marcar como leída");
    },
    async unread() {
      const { data, error } = await supabase.rpc("feedback_unread");
      if (error) return { mine: 0, inbox: 0 };
      const row = (Array.isArray(data) ? data[0] : data) as { mine?: number; inbox?: number } | null;
      return { mine: Number(row?.mine ?? 0), inbox: Number(row?.inbox ?? 0) };
    },
  };
  return { feedback };
}
