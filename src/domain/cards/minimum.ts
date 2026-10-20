/**
 * T8 (3.1.0): pago mínimo. Lo calcula el banco con su fórmula; el usuario lo
 * digita del estado de cuenta (por corte y moneda) y la app le dice cuánto le
 * falta para cubrirlo antes de la fecha límite.
 */

import { DomainError } from "../shared/errors.ts";
import { fromCents, toCents } from "../shared/money.ts";

/** T8: el mínimo es ≥ 0 y no pasa el saldo al corte (si pasa, es un error de digitación). */
export function validateMinimumPayment(amount: number, statementBalance: number): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new DomainError("T8", "El pago mínimo no puede ser negativo");
  }
  if (toCents(amount) > toCents(statementBalance)) {
    throw new DomainError("T8", "El pago mínimo no puede ser mayor que el saldo al corte");
  }
}

export type MinimumStatus = {
  minimum: number;
  /** Lo que falta abonar para cubrir el mínimo (0 si ya se cubrió). */
  remaining: number;
  covered: boolean;
};

/** T8: con lo abonado después del corte, ¿se cubrió el mínimo? */
export function minimumPaymentStatus(minimum: number, paidAfterCutoff: number): MinimumStatus {
  const remaining = Math.max(0, toCents(minimum) - toCents(paidAfterCutoff));
  return { minimum, remaining: fromCents(remaining), covered: remaining === 0 };
}
