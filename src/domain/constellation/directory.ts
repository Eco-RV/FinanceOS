/**
 * Directorio de la Constelación (3.0.0): lo personal que NUNCA va a la cadena
 * (K2) — apodo, emoji y parentesco de cada dirección, la wallet ligada del
 * usuario y las invitaciones a la familia. Vive en Finance OS (Supabase, RLS).
 */

import { DomainError } from "../shared/errors.ts";

/** Dirección de cuenta Stellar: `G` + 55 caracteres base32 (sin validar el checksum). */
export function isStellarAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}

export function assertStellarAddress(value: string): string {
  const address = value.trim();
  if (!isStellarAddress(address)) {
    throw new DomainError("K2", "Esa dirección no es válida (empieza con G y tiene 56 caracteres)");
  }
  return address;
}

/** Parentescos sugeridos (texto libre permitido). */
export const RELATIONSHIPS = [
  "Mamá",
  "Papá",
  "Abuela",
  "Abuelo",
  "Hermana",
  "Hermano",
  "Hija",
  "Hijo",
  "Tía",
  "Tío",
  "Pareja",
  "Prima",
  "Primo",
  "Amiga",
  "Amigo",
] as const;

export type StarLabelFields = {
  address: string;
  nickname: string;
  emoji: string | null;
  relationship: string | null;
  /** Miembro de cobros (2.3.0) ligado, opcional (D13). */
  member_id: string | null;
};

/** Valida y normaliza los datos de una estrella en la agenda del usuario (D3). */
export function normalizeStarLabel(fields: StarLabelFields): StarLabelFields {
  const address = assertStellarAddress(fields.address);
  const nickname = fields.nickname.trim();
  if (!nickname || nickname.length > 40) {
    throw new DomainError("K2", "El apodo lleva de 1 a 40 caracteres");
  }
  const emoji = fields.emoji?.trim() || null;
  if (emoji && [...emoji].length > 4) throw new DomainError("K2", "Usa un solo emoji");
  const relationship = fields.relationship?.trim() || null;
  if (relationship && relationship.length > 30) {
    throw new DomainError("K2", "El parentesco lleva hasta 30 caracteres");
  }
  return { address, nickname, emoji, relationship, member_id: fields.member_id || null };
}

/** Una invitación vale 72 horas (D2: se canjea con sesión de Finance OS). */
export const INVITE_TTL_HOURS = 72;

export function inviteExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000);
}

export type InviteState = "pending" | "redeemed" | "added" | "expired" | "revoked";

/** Estado de una invitación para mostrarla al núcleo. */
export function inviteState(
  invite: { expires_at: string; redeemed_at: string | null; added_at: string | null; revoked: boolean },
  now: Date,
): InviteState {
  if (invite.revoked) return "revoked";
  if (invite.added_at) return "added";
  if (invite.redeemed_at) return "redeemed";
  return new Date(invite.expires_at) < now ? "expired" : "pending";
}

/** Lecciones de la Academia (contenido en la app; progreso en Finance OS). */
export const ACADEMY_LESSONS = ["wallet", "blockchain", "usdc", "enviar-sin-miedo", "boveda"] as const;
export type AcademyLesson = (typeof ACADEMY_LESSONS)[number];

export function assertLesson(key: string): AcademyLesson {
  if (!(ACADEMY_LESSONS as readonly string[]).includes(key)) {
    throw new DomainError("K2", "Esa lección no existe");
  }
  return key as AcademyLesson;
}

/** Puntaje del quiz en porcentaje (0–100), redondeado. */
export function quizScore(correct: number, total: number): number {
  if (!(total > 0) || correct < 0 || correct > total) throw new DomainError("K2", "Puntaje inválido");
  return Math.round((correct / total) * 100);
}
