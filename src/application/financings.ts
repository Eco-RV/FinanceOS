/** Casos de uso de financiamientos sin interés (tasa 0). */

import { installmentSchedule, type Installment, type ISODate } from "../domain/index.ts";
import type { CardRepository, FinancingRepository } from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

export type FinancingDeps = {
  cards: CardRepository;
  financings: FinancingRepository;
};

export type CreateFinancingInput = {
  card_id: string;
  description: string;
  category: string | null;
  total_amount: number;
  months: number;
  first_charge_on: ISODate;
};

export type CreateFinancingOutput = { id: string; installments: Installment[] };

/**
 * Crea un financiamiento y sus N cuotas (F1, F2). El plan de cuotas lo calcula
 * el dominio (`installmentSchedule`); la persistencia guarda exactamente ese
 * plan, de forma atómica.
 */
export function createFinancing(
  deps: FinancingDeps,
  input: CreateFinancingInput,
): Promise<UseCaseResult<CreateFinancingOutput>> {
  return run(async () => {
    const currency = await deps.cards.currencyOf(input.card_id);
    if (!currency) return fail("Tarjeta no encontrada");

    // Valida monto y meses, y deja el plan listo para mostrar o verificar.
    const installments = installmentSchedule({
      totalAmount: input.total_amount,
      months: input.months,
      firstChargeOn: input.first_charge_on,
      currency,
    });

    const { id } = await deps.financings.createWithInstallments(input, installments);
    return ok({ id, installments });
  });
}

/** Elimina un financiamiento completo. Devuelve la tarjeta para refrescar su vista. */
export function deleteFinancing(
  deps: Pick<FinancingDeps, "financings">,
  id: string,
): Promise<UseCaseResult<{ cardId: string | null }>> {
  return run(async () => {
    const cardId = await deps.financings.cardIdOf(id);
    await deps.financings.delete(id);
    return ok({ cardId });
  });
}
