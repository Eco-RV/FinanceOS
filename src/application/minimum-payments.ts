/** T8 (3.0.1): pago mínimo de la tarjeta, digitado del estado de cuenta. */

import { assertActive, validateMinimumPayment } from "../domain/index.ts";
import type { CardRepository, MinimumPayment, MinimumPaymentRepository } from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

/**
 * Guarda el mínimo del corte vigente. `statementBalance` es el saldo al corte
 * que ve el usuario: el mínimo no lo puede pasar. Monto vacío/0 lo borra.
 */
export function setMinimumPayment(
  deps: { minimumPayments: MinimumPaymentRepository; cards: CardRepository },
  input: MinimumPayment & { statementBalance: number },
): Promise<UseCaseResult> {
  return run(async () => {
    const card = await deps.cards.find(input.card_id);
    if (!card) return fail("Tarjeta no encontrada");
    assertActive("card", card.name, card.archived);
    const { statementBalance, ...payment } = input;
    if (!(payment.amount > 0)) {
      await deps.minimumPayments.delete({ card_id: payment.card_id, cutoff_on: payment.cutoff_on, currency: payment.currency });
      return ok();
    }
    validateMinimumPayment(payment.amount, statementBalance);
    await deps.minimumPayments.save(payment);
    return ok();
  });
}
