/**
 * Casos de uso de la Constelación familiar (3.0.0) que viven en Finance OS:
 * la wallet ligada, la agenda de estrellas (apodos, K2), las invitaciones a la
 * familia (D2) y el progreso en la Academia. Lo que mueve dinero o cambia la
 * familia en la cadena lo firma el usuario en el navegador (contrato `family`).
 */

import {
  assertLesson,
  assertStellarAddress,
  DomainError,
  inviteExpiresAt,
  normalizeStarLabel,
  quizScore,
  type StarLabelFields,
} from "../domain/index.ts";
import type {
  AcademyRepository,
  FamilyInviteRepository,
  InviteRole,
  InviteTokenService,
  LinkedWallet,
  StarDirectoryRepository,
  WalletLinkRepository,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

/** Liga la wallet de Stellar del usuario (solo la dirección pública). */
export function linkWallet(
  wallets: WalletLinkRepository,
  wallet: LinkedWallet,
): Promise<UseCaseResult> {
  return run(async () => {
    const address = assertStellarAddress(wallet.address);
    const current = await wallets.current();
    if (current?.address === address && current.connector === wallet.connector) return ok();
    await wallets.link({ address, connector: wallet.connector });
    return ok();
  });
}

/** Crea o edita una estrella de la agenda (apodo, emoji, parentesco). */
export function saveStar(
  stars: StarDirectoryRepository,
  input: { id: string | null; fields: StarLabelFields },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => ok(await stars.save(input.id, normalizeStarLabel(input.fields))));
}

export function deleteStar(stars: StarDirectoryRepository, id: string): Promise<UseCaseResult> {
  return run(async () => {
    await stars.delete(id);
    return ok();
  });
}

const ROLES: readonly InviteRole[] = ["guardian", "member"];

/**
 * El núcleo (o un guardián) invita a alguien a su familia: devuelve el token
 * para armar el enlace. Solo se guarda su hash; vence en 72 h.
 */
export function createFamilyInvite(
  deps: { invites: FamilyInviteRepository; tokens: InviteTokenService },
  input: { familyId: number; role: InviteRole; now: Date },
): Promise<UseCaseResult<{ id: string; token: string; expiresAt: string }>> {
  return run(async () => {
    if (!Number.isInteger(input.familyId) || input.familyId < 0) return fail("Familia inválida");
    if (!ROLES.includes(input.role)) return fail("Rol inválido");
    const { token, hash } = deps.tokens.newToken();
    const expiresAt = inviteExpiresAt(input.now).toISOString();
    const { id } = await deps.invites.create({
      family_id: input.familyId,
      role: input.role,
      token_hash: hash,
      expires_at: expiresAt,
    });
    return ok({ id, token, expiresAt });
  });
}

/**
 * Quien recibió el enlace (con sesión, D2) lo canjea con su wallet: queda su
 * dirección para que el núcleo la agregue en la cadena.
 */
export function redeemFamilyInvite(
  invites: FamilyInviteRepository,
  input: { token: string; address: string },
): Promise<UseCaseResult<{ family_id: number; role: InviteRole }>> {
  return run(async () => {
    const token = input.token.trim();
    if (token.length < 16) return fail("Enlace de invitación inválido");
    const address = assertStellarAddress(input.address);
    return ok(await invites.redeem(token, address));
  });
}

export function revokeFamilyInvite(invites: FamilyInviteRepository, id: string): Promise<UseCaseResult> {
  return run(async () => {
    const invite = await invites.find(id);
    if (!invite) return fail("Invitación no encontrada");
    if (invite.added_at) return fail("Esa invitación ya se usó");
    await invites.revoke(id);
    return ok();
  });
}

/** Después de agregar en la cadena la dirección canjeada, se marca la invitación. */
export function markFamilyInviteAdded(invites: FamilyInviteRepository, id: string): Promise<UseCaseResult> {
  return run(async () => {
    const invite = await invites.find(id);
    if (!invite) return fail("Invitación no encontrada");
    if (!invite.redeemed_address) throw new DomainError("K6", "Esa invitación todavía no se canjeó");
    if (!invite.added_at) await invites.markAdded(id);
    return ok();
  });
}

/** Guarda el resultado del quiz de una lección (se conserva el mejor). */
export function completeLesson(
  academy: AcademyRepository,
  input: { lesson: string; correct: number; total: number },
): Promise<UseCaseResult<{ score: number }>> {
  return run(async () => {
    const lesson = assertLesson(input.lesson);
    const score = quizScore(input.correct, input.total);
    await academy.record(lesson, score);
    return ok({ score });
  });
}
