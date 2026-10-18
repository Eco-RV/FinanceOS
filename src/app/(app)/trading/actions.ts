"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createFamilyInvite,
  deleteStar,
  linkWallet,
  markFamilyInviteAdded,
  redeemFamilyInvite,
  revokeFamilyInvite,
  saveStar,
  type UseCaseResult,
} from "@/application";
import { repositories } from "@/infrastructure/container";

/**
 * Server Actions de la Constelación familiar (3.0.0). Solo tocan Finance OS
 * (Supabase): lo que cambia la cadena lo firma el usuario en el navegador.
 */

export type ActionResult<T = void> = { ok: true; value: T } | { ok: false; message: string };

function toResult<T>(r: UseCaseResult<T>): ActionResult<T> {
  return r.ok ? { ok: true, value: r.value } : { ok: false, message: r.message };
}

const address = z.string().trim().regex(/^G[A-Z2-7]{55}$/, "Dirección inválida");
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/);

function revalidate() {
  revalidatePath("/trading", "layout");
}

/** Liga la wallet conectada a la cuenta de Finance OS (solo la dirección). */
export async function linkWalletAction(input: {
  address: string;
  connector: "cavos" | "extension";
}): Promise<ActionResult> {
  await requireUser();
  const parsed = z.object({ address, connector: z.enum(["cavos", "extension"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Wallet inválida" };
  const r = await linkWallet((await repositories()).wallets, parsed.data);
  return r.ok ? { ok: true, value: undefined } : { ok: false, message: r.message };
}

const starSchema = z.object({
  id: uuid.nullable(),
  address,
  nickname: z.string().trim().min(1, "Ponle un apodo").max(40),
  emoji: z.string().trim().max(8).nullable(),
  relationship: z.string().trim().max(30).nullable(),
});

/** Apodo, emoji y parentesco de una dirección en MI agenda (K2: fuera de la cadena). */
export async function saveStarAction(input: z.input<typeof starSchema>): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const parsed = starSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, ...fields } = parsed.data;
  const r = await saveStar((await repositories()).stars, { id, fields: { ...fields, member_id: null } });
  if (r.ok) revalidate();
  return toResult(r);
}

export async function deleteStarAction(id: string): Promise<ActionResult> {
  await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Estrella inválida" };
  const r = await deleteStar((await repositories()).stars, id);
  if (r.ok) revalidate();
  return r.ok ? { ok: true, value: undefined } : { ok: false, message: r.message };
}

/** Crea una invitación y devuelve el token (para el enlace); solo se guarda su hash. */
export async function createInviteAction(input: {
  familyId: number;
  role: "guardian" | "member";
}): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  await requireUser();
  const parsed = z
    .object({ familyId: z.number().int().min(0), role: z.enum(["guardian", "member"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invitación inválida" };
  const repos = await repositories();
  const r = await createFamilyInvite(
    { invites: repos.invites, tokens: repos.inviteTokens },
    { ...parsed.data, now: new Date() },
  );
  if (r.ok) revalidate();
  return r.ok ? { ok: true, value: { token: r.value.token, expiresAt: r.value.expiresAt } } : r;
}

export async function revokeInviteAction(id: string): Promise<ActionResult> {
  await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invitación inválida" };
  const r = await revokeFamilyInvite((await repositories()).invites, id);
  if (r.ok) revalidate();
  return r.ok ? { ok: true, value: undefined } : { ok: false, message: r.message };
}

/** Después de agregar en la cadena la dirección que canjeó la invitación. */
export async function markInviteAddedAction(id: string): Promise<ActionResult> {
  await requireUser();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Invitación inválida" };
  const r = await markFamilyInviteAdded((await repositories()).invites, id);
  if (r.ok) revalidate();
  return r.ok ? { ok: true, value: undefined } : { ok: false, message: r.message };
}

/** Quien recibió el enlace lo canjea con su wallet (D2: con sesión). */
export async function redeemInviteAction(input: {
  token: string;
  address: string;
}): Promise<ActionResult<{ family_id: number; role: "guardian" | "member" }>> {
  await requireUser();
  const parsed = z.object({ token: z.string().min(16).max(128), address }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enlace o wallet inválidos" };
  const r = await redeemFamilyInvite((await repositories()).invites, parsed.data);
  if (r.ok) revalidate();
  return toResult(r);
}
