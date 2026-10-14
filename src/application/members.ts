/**
 * Miembros en financiamientos: reparto por cuota (F6), reembolsos (F7) y
 * avisos de cuota (F8). Nada de esto toca tarjetas ni cuentas.
 */

import { assertActive, validateShares, type MemberShare } from "../domain/index.ts";
import type {
  FinancingRepository,
  Mailer,
  MemberFields,
  MemberRepository,
  NewNotice,
  NewReimbursement,
  NoticeRepository,
  ReimbursementRepository,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

/** Crea o edita un miembro. No se edita uno desactivado (G4). */
export function saveMember(
  members: MemberRepository,
  input: { id: string | null; fields: MemberFields },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    if (input.id) {
      const current = await members.find(input.id);
      if (!current) return fail("Miembro no encontrado");
      assertActive("member", current.name, current.archived);
    }
    if (!input.fields.email && !input.fields.phone) {
      return fail("Poné al menos un correo o un teléfono para poder avisarle", "F8");
    }
    return ok(await members.save(input.id, input.fields));
  });
}

export type ShareDeps = {
  financings: FinancingRepository;
  members: MemberRepository;
  reimbursements: ReimbursementRepository;
};

/**
 * F6: reemplaza el reparto de un financiamiento. Un miembro nuevo debe estar
 * activo (G4); no se quita a quien ya tiene reembolsos registrados (F7).
 */
export function setFinancingShares(
  deps: ShareDeps,
  input: { financing_id: string; shares: MemberShare[] },
): Promise<UseCaseResult<{ cardId: string }>> {
  return run(async () => {
    const plan = await deps.financings.find(input.financing_id);
    if (!plan) return fail("Financiamiento no encontrado");

    const before = await deps.financings.shares(input.financing_id);
    const had = new Set(before.map((s) => s.member_id));
    for (const s of input.shares) {
      const member = await deps.members.find(s.member_id);
      if (!member) return fail("Miembro no encontrado");
      if (!had.has(s.member_id)) assertActive("member", member.name, member.archived);
    }

    validateShares(input.shares, await deps.financings.installments(input.financing_id));

    const keep = new Set(input.shares.map((s) => s.member_id));
    for (const memberId of await deps.reimbursements.membersWithReimbursements(input.financing_id)) {
      if (keep.has(memberId)) continue;
      const member = await deps.members.find(memberId);
      return fail(
        `${member?.name ?? "Ese miembro"} ya tiene reembolsos en este financiamiento: deshacelos antes de quitarlo`,
        "F7",
      );
    }

    await deps.financings.replaceShares(input.financing_id, input.shares);
    return ok({ cardId: plan.card_id });
  });
}

/** F7: registra que un miembro pagó su parte de una cuota (por el monto de su parte). */
export function recordReimbursement(
  deps: Pick<ShareDeps, "financings" | "reimbursements">,
  input: Omit<NewReimbursement, "amount">,
): Promise<UseCaseResult<{ id: string; cardId: string }>> {
  return run(async () => {
    const plan = await deps.financings.find(input.financing_id);
    if (!plan) return fail("Financiamiento no encontrado");
    const share = (await deps.financings.shares(input.financing_id)).find(
      (s) => s.member_id === input.member_id,
    );
    if (!share) return fail("Ese miembro no tiene parte en este financiamiento", "F6");
    const exists = (await deps.financings.installments(input.financing_id)).some(
      (c) => c.no === input.installment_no,
    );
    if (!exists) return fail("Esa cuota no existe", "F7");

    const { id } = await deps.reimbursements.create({ ...input, amount: share.amount });
    return ok({ id, cardId: plan.card_id });
  });
}

/** Deshace un reembolso registrado por error. */
export function undoReimbursement(
  deps: Pick<ShareDeps, "financings" | "reimbursements">,
  id: string,
): Promise<UseCaseResult<{ cardId: string | null }>> {
  return run(async () => {
    const financingId = await deps.reimbursements.delete(id);
    if (!financingId) return fail("Reembolso no encontrado");
    return ok({ cardId: await deps.financings.cardIdOf(financingId) });
  });
}

/** F8: deja constancia de un aviso enviado (p. ej. por WhatsApp, que envía el usuario). */
export function recordNotices(
  notices: NoticeRepository,
  items: NewNotice[],
): Promise<UseCaseResult> {
  return run(async () => {
    if (items.length === 0) return fail("No hay nada que avisar");
    await notices.record(items);
    return ok();
  });
}

/** F8: envía el aviso por correo desde la cuenta del usuario y lo registra. */
export function sendNoticeEmail(
  deps: { mailer: Mailer; notices: NoticeRepository },
  input: { to: string | null; subject: string; text: string; items: NewNotice[] },
): Promise<UseCaseResult> {
  return run(async () => {
    if (!input.to) return fail("Ese miembro no tiene correo", "F8");
    if (input.items.length === 0) return fail("No hay nada que avisar");
    await deps.mailer.send({ to: input.to, subject: input.subject, text: input.text });
    await deps.notices.record(input.items);
    return ok();
  });
}
