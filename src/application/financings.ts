/** Casos de uso de financiamientos sobre tarjeta, con o sin interés. */

import {
  crToday,
  financingSchedule,
  toISODate,
  type FinancingInstallment,
  type ISODate,
} from "../domain/index.ts";
import type { CardRepository, FinancingFields, FinancingRepository } from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

export type FinancingDeps = {
  cards: CardRepository;
  financings: FinancingRepository;
};

export type CreateFinancingInput = {
  card_id: string;
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
    const currency = await deps.cards.currencyOf(input.card_id);
    if (!currency) return fail("Tarjeta no encontrada");

    const annual_rate = input.annual_rate ?? 0;
    const installments = financingSchedule({
      principal: input.total_amount,
      annualRatePercent: annual_rate,
      months: input.months,
      firstChargeOn: input.first_charge_on,
      currency,
    });

    const { id } = await deps.financings.createWithInstallments(
      { ...input, annual_rate },
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
