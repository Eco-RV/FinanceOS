/**
 * Adaptador Supabase de la Constelación familiar (3.0.0): wallet ligada,
 * agenda de estrellas, invitaciones y Academia. SQL en
 * `supabase/Versionamiento/3.0.0/`. Sin ese SQL, las lecturas devuelven vacío
 * y las escrituras avisan que falta correrlo.
 */

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcademyLesson } from "@/domain";
import {
  InfrastructureError,
  type AcademyRepository,
  type FamilyInvite,
  type FamilyInviteRepository,
  type InviteRole,
  type InviteTokenService,
  type StarDirectoryRepository,
  type StarLabel,
  type WalletLinkRepository,
} from "@/application";

type PgError = { message: string; code?: string } | null;

const UNIQUE_VIOLATION = "23505";
/** La tabla o función no existe (SQL 3.0.0 sin correr). */
const MISSING = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);
const MISSING_SQL = "Falta correr el SQL de la versión 3.0.0 (Constelación)";

function check(error: PgError, message: string): void {
  if (!error) return;
  if (error.code && MISSING.has(error.code)) throw new InfrastructureError(MISSING_SQL);
  throw new InfrastructureError(message);
}

const INVITE_COLUMNS =
  "id, family_id, role, expires_at, redeemed_address, redeemed_at, added_at, revoked";

export function supabaseConstellation(supabase: SupabaseClient) {
  const wallets: WalletLinkRepository = {
    async current() {
      const { data, error } = await supabase
        .from("stellar_wallets")
        .select("address, connector")
        .eq("archived", false)
        .maybeSingle();
      if (error) return null;
      return data ? { address: data.address as string, connector: data.connector as "cavos" | "extension" } : null;
    },
    async link(wallet) {
      // Una activa por usuario: se archiva la anterior y se inserta la nueva.
      const { error: e1 } = await supabase.from("stellar_wallets").update({ archived: true }).eq("archived", false);
      check(e1, "No se pudo ligar la wallet");
      const { error } = await supabase.from("stellar_wallets").insert(wallet);
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Esa wallet ya está ligada a otra cuenta de Finance OS");
      }
      check(error, "No se pudo ligar la wallet");
    },
    async unlink() {
      const { error } = await supabase.from("stellar_wallets").update({ archived: true }).eq("archived", false);
      check(error, "No se pudo desligar la wallet");
    },
  };

  const stars: StarDirectoryRepository = {
    async list() {
      const { data, error } = await supabase
        .from("constellation_stars")
        .select("id, address, nickname, emoji, relationship, member_id")
        .eq("archived", false)
        .order("created_at", { ascending: true });
      if (error) return [];
      return (data ?? []) as StarLabel[];
    },
    async save(id, fields) {
      const { data, error } = id
        ? await supabase.from("constellation_stars").update(fields).eq("id", id).select("id").single()
        : await supabase.from("constellation_stars").insert(fields).select("id").single();
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Esa dirección ya está en tu constelación");
      }
      check(error, "No se pudo guardar la estrella");
      return { id: data!.id as string };
    },
    async delete(id) {
      const { error } = await supabase.from("constellation_stars").delete().eq("id", id);
      check(error, "No se pudo quitar la estrella");
    },
  };

  const invites: FamilyInviteRepository = {
    async create(invite) {
      const { data, error } = await supabase.from("family_invites").insert(invite).select("id").single();
      check(error, "No se pudo crear la invitación");
      return { id: data!.id as string };
    },
    async listMine() {
      const { data, error } = await supabase
        .from("family_invites")
        .select(INVITE_COLUMNS)
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as FamilyInvite[];
    },
    async find(id) {
      const { data } = await supabase.from("family_invites").select(INVITE_COLUMNS).eq("id", id).maybeSingle();
      return (data as FamilyInvite | null) ?? null;
    },
    async revoke(id) {
      const { error } = await supabase.from("family_invites").update({ revoked: true }).eq("id", id);
      check(error, "No se pudo revocar la invitación");
    },
    async markAdded(id) {
      const { error } = await supabase
        .from("family_invites")
        .update({ added_at: new Date().toISOString() })
        .eq("id", id);
      check(error, "No se pudo actualizar la invitación");
    },
    async redeem(token, address) {
      // supabase/Versionamiento/3.0.0/02_family_invites.sql (security definer).
      const { data, error } = await supabase.rpc("redeem_family_invite", {
        p_token: token,
        p_address: address,
      });
      if (error) {
        if (error.code && MISSING.has(error.code)) throw new InfrastructureError(MISSING_SQL);
        // Los mensajes de la función ya están en español y son mostrables.
        throw new InfrastructureError(error.message || "No se pudo canjear la invitación");
      }
      const row = (Array.isArray(data) ? data[0] : data) as { family_id: number; role: InviteRole } | undefined;
      if (!row) throw new InfrastructureError("No se pudo canjear la invitación");
      return { family_id: Number(row.family_id), role: row.role };
    },
  };

  const academy: AcademyRepository = {
    async list() {
      const { data, error } = await supabase
        .from("academy_progress")
        .select("lesson_key, score, completed_at")
        .eq("archived", false);
      if (error) return [];
      return (data ?? []).map((r) => ({
        lesson: r.lesson_key as AcademyLesson,
        score: Number(r.score),
        completed_at: r.completed_at as string,
      }));
    },
    async record(lesson, score) {
      const { data: current } = await supabase
        .from("academy_progress")
        .select("score")
        .eq("lesson_key", lesson)
        .maybeSingle();
      if (current && Number(current.score) >= score) return;
      const { error } = await supabase
        .from("academy_progress")
        .upsert(
          { lesson_key: lesson, score, completed_at: new Date().toISOString() },
          { onConflict: "user_id,lesson_key" },
        );
      check(error, "No se pudo guardar el progreso");
    },
  };

  const inviteTokens: InviteTokenService = {
    newToken() {
      const token = randomBytes(24).toString("base64url");
      return { token, hash: createHash("sha256").update(token, "utf8").digest("hex") };
    },
  };

  return { wallets, stars, invites, academy, inviteTokens };
}
