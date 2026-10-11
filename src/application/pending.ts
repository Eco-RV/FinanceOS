/** Casos de uso de la bandeja "Por confirmar" (importación desde correo). */

import { assertSameCurrency, isCurrency, merchantKey } from "../domain/index.ts";
import type {
  CardRepository,
  MerchantRuleRepository,
  MovementRepository,
  PendingRepository,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

export type PendingDeps = {
  cards: CardRepository;
  movements: MovementRepository;
  pending: PendingRepository;
  merchantRules: MerchantRuleRepository;
};

export type ApprovePendingInput = {
  id: string;
  card_id: string;
  category: string;
};

/**
 * Aprueba un pendiente (I4, I5): crea el gasto en la tarjeta elegida, marca el
 * pendiente como aprobado y aprende comercio → categoría.
 */
export function approvePending(
  deps: PendingDeps,
  input: ApprovePendingInput,
): Promise<UseCaseResult<{ movementId: string }>> {
  return run(async () => {
    const pending = await deps.pending.findOpen(input.id);
    if (!pending) return fail("El pendiente ya no está por confirmar");

    const cardCurrency = await deps.cards.currencyOf(input.card_id);
    if (!cardCurrency) return fail("Tarjeta no encontrada");
    if (!isCurrency(pending.currency)) return fail(`Moneda no soportada: ${pending.currency}`);
    assertSameCurrency(pending.currency, cardCurrency, "I5");

    const category = input.category.trim();
    if (!category) return fail("La categoría es obligatoria", "M1");

    const { id: movementId } = await deps.movements.create({
      type: "expense",
      amount: pending.amount,
      currency: pending.currency,
      occurred_on: pending.occurred_on,
      category,
      note: pending.merchant.slice(0, 200),
      account_id: null,
      card_id: input.card_id,
    });

    await deps.pending.markApproved(input.id, movementId, input.card_id);
    await deps.merchantRules.learn(merchantKey(pending.merchant), category);

    return ok({ movementId });
  });
}

/** Descarta un pendiente: no se crea ningún movimiento. */
export function rejectPending(
  deps: Pick<PendingDeps, "pending">,
  id: string,
): Promise<UseCaseResult> {
  return run(async () => {
    await deps.pending.markRejected(id);
    return ok();
  });
}
