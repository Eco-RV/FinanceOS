/** Casos de uso de financiamientos sobre tarjeta, con o sin interés. */

import {
  assertSameCurrency,
  crToday,
  DomainError,
  financingPrepaymentPlan,
  financingSchedule,
  validateMovement,
  type PrepaymentMode,
  toISODate,
  type Currency,
  type FinancingInstallment,
  type ISODate,
} from "../domain/index.ts";
import type {
  AccountRepository,
  CardRepository,
  FinancingFields,
  FinancingRepository,
  MovementRepository,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

export type FinancingDeps = {
  cards: CardRepository;
  financings: FinancingRepository;
};

export type CreateFinancingInput = {
  card_id: string;
  /** F10 (3.0.1): CRC o USD; sin elegir, la moneda del límite de la tarjeta. */
  currency?: Currency;
  description: string;
  category: string | null;
  /** Capital (en tasa 0, el total de la compra). */
  total_amount: number;
  /** Tasa anual en porcentaje; 0 o ausente = sin interés. */
  annual_rate?: number;
  months: number;
  first_charge_on: ISODate;
};

export type CreateFinancingOutput = { id: string; installments: FinancingInstallment[] };

/**
 * Crea un financiamiento y sus N cuotas (F1, F2, F5). El plan lo calcula el
 * dominio (`financingSchedule`); la persistencia guarda exactamente ese plan,
 * de forma atómica.
 */
export function createFinancing(
  deps: FinancingDeps,
  input: CreateFinancingInput,
): Promise<UseCaseResult<CreateFinancingOutput>> {
  return run(async () => {
    const cardCurrency = await deps.cards.currencyOf(input.card_id);
    if (!cardCurrency) return fail("Tarjeta no encontrada");
    // F10 (3.0.1): el plan puede ir en la otra moneda de la tarjeta (T1).
    const currency = input.currency ?? cardCurrency;

    const annual_rate = input.annual_rate ?? 0;
    const installments = financingSchedule({
      principal: input.total_amount,
      annualRatePercent: annual_rate,
      months: input.months,
      firstChargeOn: input.first_charge_on,
      currency,
    });

    const { id } = await deps.financings.createWithInstallments(
      { ...input, annual_rate, currency },
      installments,
    );
    return ok({ id, installments });
  });
}

/** F9: cambia la descripción y la categoría (también en sus cuotas). Los términos no se editan. */
export function updateFinancing(
  deps: Pick<FinancingDeps, "financings">,
  input: { id: string } & FinancingFields,
): Promise<UseCaseResult<{ cardId: string }>> {
  return run(async () => {
    const current = await deps.financings.find(input.id);
    if (!current) return fail("Financiamiento no encontrado");
    await deps.financings.update(input.id, {
      description: input.description,
      category: input.category,
    });
    return ok({ cardId: current.card_id });
  });
}

/**
 * Elimina un financiamiento (F4): las cuotas futuras desaparecen, las que ya
 * ocurrieron (fecha ≤ hoy) se conservan. "Hoy" es el de Costa Rica (G6).
 */
export function deleteFinancing(
  deps: Pick<FinancingDeps, "financings">,
  id: string,
  today: Date = crToday(),
): Promise<UseCaseResult<{ cardId: string | null; outcome: "cancelled" | "deleted" }>> {
  return run(async () => {
    const cardId = await deps.financings.cardIdOf(id);
    if (!cardId) return fail("Financiamiento no encontrado");
    const outcome = await deps.financings.cancel(id, toISODate(today));
    return ok({ cardId, outcome });
  });
}

export type PrepayFinancingInput = {
  financing_id: string;
  account_id: string;
  amount: number;
  mode: PrepaymentMode;
  occurred_on: ISODate;
  today: ISODate;
};

/**
 * F11 (3.0.1): abono extraordinario al capital de un financiamiento. El dinero
 * sale de una cuenta como un gasto (la misma plata que antes iba a salir en
 * cuotas) y las cuotas programadas se reemplazan por un plan con menos
 * capital: la deuda de la tarjeta baja una sola vez, por el abono.
 */
export function prepayFinancing(
  deps: Pick<FinancingDeps, "financings"> & { accounts: AccountRepository; movements: MovementRepository },
  input: PrepayFinancingInput,
): Promise<UseCaseResult<{ cardId: string; installments: number }>> {
  return run(async () => {
    const plan = await deps.financings.find(input.financing_id);
    if (!plan) return fail("Financiamiento no encontrado");
    if (plan.cancelled_on) return fail("El financiamiento está cancelado", "F11");
    const accountCurrency = await deps.accounts.currencyOf(input.account_id);
    if (!accountCurrency) throw new DomainError("G4", "Cuenta no encontrada o desactivada");
    assertSameCurrency(accountCurrency, plan.currency);

    const pending = await deps.financings.pendingInstallments(plan.id, input.today);
    const next = financingPrepaymentPlan({
      pending,
      annualRatePercent: plan.annual_rate ?? 0,
      amount: input.amount,
      mode: input.mode,
    });
    const category = plan.category ?? "Financiamientos";
    const currency = validateMovement({
      type: "expense",
      amount: input.amount,
      category,
      accountCurrency,
      cardCurrency: null,
    });
    const { id: movementId } = await deps.movements.create({
      type: "expense",
      amount: input.amount,
      currency,
      occurred_on: input.occurred_on,
      category,
      note: `${plan.description} · abono extraordinario al capital (${input.mode === "term" ? "baja el plazo" : "baja la cuota"})`.slice(0, 200),
      account_id: input.account_id,
      card_id: null,
    });
    try {
      await deps.financings.prepay(plan.id, {
        todayISO: input.today,
        fromNo: pending[0].no,
        installments: next.installments,
        amount: input.amount,
        mode: input.mode,
        occurred_on: input.occurred_on,
        transaction_id: movementId,
      });
    } catch (e) {
      await deps.movements.delete(movementId);
      throw e;
    }
    return ok({ cardId: plan.card_id, installments: next.installments.length });
  });
}

/** F11: deshace el último abono (vuelve el plan anterior y borra su gasto). */
export function undoFinancingPrepayment(
  deps: Pick<FinancingDeps, "financings">,
  input: { financing_id: string; today: ISODate },
): Promise<UseCaseResult<{ cardId: string }>> {
  return run(async () => {
    const plan = await deps.financings.find(input.financing_id);
    if (!plan) return fail("Financiamiento no encontrado");
    const last = await deps.financings.lastPrepayment(plan.id);
    if (!last) return fail("Este financiamiento no tiene abonos");
    await deps.financings.undoPrepayment(last.id, input.today);
    return ok({ cardId: plan.card_id });
  });
}
