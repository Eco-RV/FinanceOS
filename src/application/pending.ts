/** Casos de uso de la bandeja "Por confirmar" (importación desde correo). */

import { assertCategoryUsable, isCurrency, merchantKey } from "../domain/index.ts";
import type {
  CardRepository,
  CategoryRepository,
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
  categories: CategoryRepository;
};

export type ApprovePendingInput = {
  id: string;
  card_id: string;
  category: string;
};

/**
 * Aprueba un pendiente (I4, I5): crea el gasto en la tarjeta elegida (en la
 * moneda de la compra, T1), marca el
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
    // I5 (2.0.0): la tarjeta es bimoneda (T1); la compra va al saldo de su moneda.
    if (!isCurrency(pending.currency)) return fail(`Moneda no soportada: ${pending.currency}`, "I5");

    const category = input.category.trim();
    if (!category) return fail("La categoría es obligatoria", "M1");
    assertCategoryUsable({
      category,
      deactivated: await deps.categories.isDeactivated("expense", category),
    });

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
