/**
 * Adaptador Supabase de la cuenta del usuario (2.6.0): tabla `profiles`,
 * Auth (correo y contraseña) y Storage (`avatars/<user_id>/…`). SQL en
 * `supabase/Versionamiento/2.6.0/`.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  InfrastructureError,
  type AvatarStorage,
  type IdentityService,
  type Profile,
  type ProfileRepository,
} from "@/application";

const UNIQUE_VIOLATION = "23505";
/** La tabla no existe (SQL 2.6.0 sin correr): PostgREST o Postgres. */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const BUCKET = "avatars";

async function userId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new InfrastructureError("La sesión expiró. Vuelve a iniciar sesión.");
  return data.user.id;
}

function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("same") && m.includes("password"))
    return "La contraseña nueva debe ser distinta de la actual";
  if (m.includes("weak") || m.includes("password should"))
    return "La contraseña es muy débil";
  if (m.includes("already") && (m.includes("registered") || m.includes("exists")))
    return "Ya existe una cuenta con ese correo";
  if (m.includes("rate limit") || m.includes("security purposes"))
    return "Espera un momento antes de intentarlo de nuevo";
  if (m.includes("reauthentication"))
    return "Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo";
  return "No se pudo completar. Inténtalo de nuevo.";
}

export function supabaseAccount(supabase: SupabaseClient) {
  const profiles: ProfileRepository = {
    async get() {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, username, country, avatar_url, preferences")
        .maybeSingle();
      if (error) {
        if (error.code && MISSING_TABLE.has(error.code)) return null;
        throw new InfrastructureError("No se pudo leer tu perfil");
      }
      if (!data) return null;
      return {
        full_name: data.full_name ?? null,
        username: data.username ?? null,
        country: data.country ?? null,
        avatar_url: data.avatar_url ?? null,
        preferences: (data.preferences as Record<string, unknown>) ?? {},
      } satisfies Profile;
    },
    async save(fields) {
      const user_id = await userId(supabase);
      const { error } = await supabase.from("profiles").upsert({ user_id, ...fields });
      if (error?.code === UNIQUE_VIOLATION) throw new InfrastructureError("Ese usuario ya está en uso");
      if (error?.code && MISSING_TABLE.has(error.code))
        throw new InfrastructureError("Falta correr el SQL de la versión 2.6.0 (perfiles)");
      if (error) throw new InfrastructureError("No se pudo guardar tu perfil");
    },
    async setAvatarUrl(url) {
      const user_id = await userId(supabase);
      const { error } = await supabase.from("profiles").upsert({ user_id, avatar_url: url });
      if (error) throw new InfrastructureError("No se pudo guardar la foto");
    },
    async savePreferences(preferences) {
      const user_id = await userId(supabase);
      const current = (await profiles.get())?.preferences ?? {};
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id, preferences: { ...current, ...preferences } });
      if (error) throw new InfrastructureError("No se pudieron guardar las preferencias");
    },
  };

  const identity: IdentityService = {
    deleteAccount: () => deleteAccountNow(),
    async email() {
      const { data } = await supabase.auth.getUser();
      return data.user?.email ?? null;
    },
    async verifyPassword(password) {
      const email = await identity.email();
      if (!email) return false;
      // Cliente aparte, sin guardar sesión: no toca las cookies de la sesión actual.
      const probe = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { error } = await probe.auth.signInWithPassword({ email, password });
      if (!error) await probe.auth.signOut({ scope: "local" });
      return !error;
    },
    async changePassword(next) {
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw new InfrastructureError(authMessage(error.message));
    },
    async isRecoverySession() {
      const { data } = await supabase.auth.getClaims();
      const amr = (data?.claims?.amr ?? []) as ({ method: string; timestamp: number } | string)[];
      const hourAgo = Date.now() / 1000 - 3600;
      return amr.some((m) =>
        typeof m === "string" ? m === "recovery" : m.method === "recovery" && m.timestamp >= hourAgo,
      );
    },
    async changeEmail(next, redirectTo) {
      const { error } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: redirectTo },
      );
      if (error) throw new InfrastructureError(authMessage(error.message));
    },
  };

  /** U8: borra archivos (fotos y comprobantes) y el usuario; el resto cae en cascada. */
  async function deleteAccountNow(): Promise<void> {
    const id = await userId(supabase);
    for (const bucket of ["avatars", "receipts"]) {
      const { data } = await supabase.storage.from(bucket).list(id, { limit: 1000 });
      const paths = (data ?? []).map((f) => `${id}/${f.name}`);
      if (paths.length > 0) await supabase.storage.from(bucket).remove(paths);
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new InfrastructureError("Para borrar la cuenta el servidor necesita SUPABASE_SERVICE_ROLE_KEY");
    }
    const admin = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new InfrastructureError("No se pudo borrar la cuenta");
    await supabase.auth.signOut();
  }

  const avatars: AvatarStorage = {
    async upload(file) {
      const id = await userId(supabase);
      await avatars.remove();
      const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
      // Nombre nuevo cada vez: la URL pública cambia y no queda la foto vieja en caché.
      const path = `${id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file.bytes, { contentType: file.type, upsert: true });
      if (error) {
        throw new InfrastructureError(
          /bucket not found/i.test(error.message)
            ? "Falta correr el SQL de la versión 2.6.0 (fotos de perfil)"
            : "No se pudo subir la foto",
        );
      }
      return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
    async remove() {
      const id = await userId(supabase);
      const { data } = await supabase.storage.from(BUCKET).list(id);
      const paths = (data ?? []).map((f) => `${id}/${f.name}`);
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
    },
  };

  return { profiles, identity, avatars };
}

export { authMessage };
