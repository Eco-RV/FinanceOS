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
  options: { learn?: boolean } = {},
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
    if (options.learn ?? true) await deps.merchantRules.learn(merchantKey(pending.merchant), category);

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

/** 3.3.0: categoría para una compra aceptada sola cuando el comercio no tiene regla. */
export const AUTO_APPROVE_FALLBACK = "Otros";

export type AutoApproveResult = { approved: number; left: number };

/**
 * Acepta sola cada compra por confirmar que ya tiene tarjeta (3.3.0): con la
 * categoría de la regla del comercio o, sin regla, con "Otros". "Otros" no se
 * aprende como regla (no fija la categoría del comercio). Las que no tienen
 * tarjeta, o fallan, quedan por confirmar.
 */
export function autoApprovePending(deps: PendingDeps): Promise<UseCaseResult<AutoApproveResult>> {
  return run(async () => {
    const open = await deps.pending.listOpen();
    let fallbackReady: boolean | null = null;
    const ensureFallback = async () => {
      if (fallbackReady !== null) return fallbackReady;
      const names = await deps.categories.names("expense");
      const exists = names.some((n) => n.trim().toLowerCase() === AUTO_APPROVE_FALLBACK.toLowerCase());
      if (!exists) await deps.categories.save(null, { kind: "expense", name: AUTO_APPROVE_FALLBACK });
      // G4: si el usuario desactivó "Otros", no se usa; esas compras quedan pendientes.
      fallbackReady = !(await deps.categories.isDeactivated("expense", AUTO_APPROVE_FALLBACK));
      return fallbackReady;
    };

    let approved = 0;
    for (const p of open) {
      if (!p.card_id) continue;
      const rule = p.suggested_category?.trim() || null;
      if (!rule && !(await ensureFallback())) continue;
      const r = await approvePending(
        deps,
        { id: p.id, card_id: p.card_id, category: rule ?? AUTO_APPROVE_FALLBACK },
        { learn: rule !== null },
      );
      if (r.ok) approved++;
    }
    return ok({ approved, left: open.length - approved });
  });
}
