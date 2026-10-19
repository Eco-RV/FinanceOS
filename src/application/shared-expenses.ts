/**
 * Gastos compartidos (3.0.1, X1–X6): compartir un gasto entre personas
 * (miembros), registrar quién pagó y avisar. El gasto es un movimiento normal
 * (X1); el pago de una parte puede, si el usuario quiere, entrar como ingreso
 * a una cuenta (X4).
 */

import {
  assertActive,
  assertCanUnshare,
  assertKeepsPaidParts,
  assertSameCurrency,
  sharedDueDate,
  validateSharedParts,
  type ISODate,
  type SharedPaymentChannel,
  type SharedShare,
} from "../domain/index.ts";
import { deleteMovement, saveMovement, type MovementDeps, type SaveMovementInput } from "./movements.ts";
import type {
  Mailer,
  MemberRepository,
  NewSharedNotice,
  SharedExpenseRepository,
  SharedSource,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

const NOT_FOUND = "Gasto compartido no encontrado";

export type SharedDeps = MovementDeps & { members: MemberRepository };

export type ShareFields = {
  description: string;
  /** Fecha límite elegida (solo si el gasto no es de tarjeta, X3). */
  due_on: ISODate | null;
  shares: SharedShare[];
};

/** G4: una persona nueva en el reparto debe estar activa. */
async function assertMembersUsable(members: MemberRepository, shares: SharedShare[], had = new Set<string>()) {
  for (const s of shares) {
    const member = await members.find(s.member_id);
    if (!member) throw new Error(`Miembro ${s.member_id} no existe`);
    if (!had.has(s.member_id)) assertActive("member", member.name, member.archived);
  }
}

function describe(source: SharedSource, description: string): string {
  return description.trim() || source.note?.trim() || "Gasto compartido";
}

/** X1: comparte un gasto ya registrado. */
export function shareExpense(
  deps: SharedDeps,
  input: ShareFields & { movement_id: string },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    const source = await deps.sharedExpenses.source(input.movement_id);
    if (!source) return fail("Movimiento no encontrado");
    if (source.type !== "expense") return fail("Solo se comparte un gasto", "X1");
    if (source.managed_elsewhere) {
      return fail("Las cuotas y los pagos de préstamo se reparten desde su módulo", "X1");
    }
    if (await deps.sharedExpenses.linkOf(input.movement_id)) return fail("Ese gasto ya está compartido", "X1");

    validateSharedParts(source.amount, input.shares);
    await assertMembersUsable(deps.members, input.shares);
    const due_on = sharedDueDate({ occurred_on: source.occurred_on, card: source.card, chosen: input.due_on });

    return ok(
      await deps.sharedExpenses.create({
        transaction_id: source.movement_id,
        description: describe(source, input.description),
        currency: source.currency,
        total_amount: source.amount,
        due_on,
        shares: input.shares,
      }),
    );
  });
}

/**
 * X1: registra el gasto y lo comparte. Las partes se validan antes de crear el
 * movimiento; si compartir falla igual, el movimiento se borra (no queda a
 * medias).
 */
export function createSharedExpense(
  deps: SharedDeps,
  input: ShareFields & { movement: Omit<SaveMovementInput, "id" | "type"> },
): Promise<UseCaseResult<{ id: string; movementId: string; affectedCardIds: string[] }>> {
  return run(async () => {
    validateSharedParts(input.movement.amount, input.shares);
    await assertMembersUsable(deps.members, input.shares);

    const saved = await saveMovement(deps, { ...input.movement, id: null, type: "expense" });
    if (!saved.ok) return saved;

    const shared = await shareExpense(deps, { ...input, movement_id: saved.value.id });
    if (!shared.ok) {
      await deleteMovement(deps, saved.value.id);
      return shared;
    }
    return ok({ id: shared.value.id, movementId: saved.value.id, affectedCardIds: saved.value.affectedCardIds });
  });
}

/** X2/X3/X6: cambia descripción, fecha límite (si no es de tarjeta) y partes. */
export function updateSharedExpense(
  deps: Pick<SharedDeps, "sharedExpenses" | "members">,
  input: ShareFields & { id: string },
): Promise<UseCaseResult> {
  return run(async () => {
    const current = await deps.sharedExpenses.find(input.id);
    if (!current) return fail(NOT_FOUND);
    validateSharedParts(current.total_amount, input.shares);
    assertKeepsPaidParts(current.parts, input.shares);
    await assertMembersUsable(deps.members, input.shares, new Set(current.parts.map((p) => p.member_id)));
    const due_on = current.card_id
      ? current.due_on
      : sharedDueDate({ occurred_on: current.occurred_on, card: null, chosen: input.due_on });
    await deps.sharedExpenses.update(input.id, {
      description: input.description.trim() || current.description,
      due_on,
      shares: input.shares,
    });
    return ok();
  });
}

/** X6: deja de compartir (el movimiento queda); se rechaza si hay pagos. */
export function deleteSharedExpense(
  deps: Pick<SharedDeps, "sharedExpenses">,
  id: string,
): Promise<UseCaseResult> {
  return run(async () => {
    const current = await deps.sharedExpenses.find(id);
    if (!current) return fail(NOT_FOUND);
    assertCanUnshare(current.parts);
    await deps.sharedExpenses.delete(id);
    return ok();
  });
}

export type SharedPaymentInput = {
  id: string;
  member_id: string;
  paid_on: ISODate;
  channel: SharedPaymentChannel;
  note: string | null;
  /** X4: registrar además un ingreso en esta cuenta (de la misma moneda). */
  income: { account_id: string; category: string } | null;
};

/** X4: marca que una persona pagó su parte (una sola vez), con ingreso opcional. */
export function markSharedPartPaid(
  deps: SharedDeps,
  input: SharedPaymentInput,
): Promise<UseCaseResult<{ incomeId: string | null }>> {
  return run(async () => {
    const current = await deps.sharedExpenses.find(input.id);
    if (!current) return fail(NOT_FOUND);
    const part = current.parts.find((p) => p.member_id === input.member_id);
    if (!part) return fail("Esa persona no está en este gasto", "X4");
    if (part.paid_on) return fail("Esa parte ya está pagada", "X4");

    let incomeId: string | null = null;
    if (input.income) {
      const currency = await deps.accounts.currencyOf(input.income.account_id);
      if (!currency) return fail("Cuenta no encontrada o desactivada", "G4");
      assertSameCurrency(currency, current.currency);
      const member = await deps.members.find(input.member_id);
      const saved = await saveMovement(deps, {
        id: null,
        type: "income",
        amount: part.amount,
        occurred_on: input.paid_on,
        category: input.income.category,
        note: `${member?.name ?? "Pago"}: ${current.description}`.slice(0, 200),
        account_id: input.income.account_id,
        card_id: null,
      });
      if (!saved.ok) return saved;
      incomeId = saved.value.id;
    }

    try {
      await deps.sharedExpenses.setPayment(input.id, input.member_id, {
        paid_on: input.paid_on,
        channel: input.channel,
        note: input.note,
        income_transaction_id: incomeId,
      });
    } catch (e) {
      if (incomeId) await deps.movements.delete(incomeId);
      throw e;
    }
    return ok({ incomeId });
  });
}

/** X4: deshace un pago registrado por error (y borra su ingreso, si lo tenía). */
export function undoSharedPartPaid(
  deps: Pick<SharedDeps, "sharedExpenses" | "movements">,
  input: { id: string; member_id: string },
): Promise<UseCaseResult> {
  return run(async () => {
    const current = await deps.sharedExpenses.find(input.id);
    if (!current) return fail(NOT_FOUND);
    const part = current.parts.find((p) => p.member_id === input.member_id);
    if (!part?.paid_on) return fail("Esa parte no está pagada", "X4");
    await deps.sharedExpenses.setPayment(input.id, input.member_id, null);
    if (part.income_transaction_id) await deps.movements.delete(part.income_transaction_id);
    return ok();
  });
}

/** X5: deja constancia de avisos enviados (p. ej. por WhatsApp). */
export function recordSharedNotices(
  sharedExpenses: SharedExpenseRepository,
  items: NewSharedNotice[],
): Promise<UseCaseResult> {
  return run(async () => {
    if (items.length === 0) return fail("No hay nada que avisar");
    await sharedExpenses.recordNotices(items);
    return ok();
  });
}

/** X5: envía el aviso por correo desde la cuenta del usuario y lo registra. */
export function sendSharedNoticeEmail(
  deps: { mailer: Mailer; sharedExpenses: SharedExpenseRepository },
  input: { to: string | null; subject: string; text: string; items: NewSharedNotice[] },
): Promise<UseCaseResult> {
  return run(async () => {
    if (!input.to) return fail("Esa persona no tiene correo", "F8");
    if (input.items.length === 0) return fail("No hay nada que avisar");
    await deps.mailer.send({ to: input.to, subject: input.subject, text: input.text });
    await deps.sharedExpenses.recordNotices(input.items);
    return ok();
  });
}
