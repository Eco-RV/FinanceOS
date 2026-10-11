/**
 * Tabla de amortización por sistema francés (cuota fija), compartida por
 * financiamientos con interés y préstamos (regla F5). Todavía no la usa
 * ninguna pantalla: es la base de esas funciones en 2.0.0.
 */

import { DomainError } from "../shared/errors.ts";
import { addMonthsClamped, fromISODate, toISODate, type ISODate } from "../shared/calendar.ts";
import { fromCents, toCents } from "../shared/money.ts";

export type AmortizationRow = {
  no: number;
  occurred_on: ISODate;
  /** Cuota total = interés + capital. */
  payment: number;
  interest: number;
  principal: number;
  /** Capital que queda después de esta cuota. */
  balance: number;
};

export type AmortizationSchedule = {
  /** Cuota fija (la última puede variar unos céntimos para cerrar en 0). */
  payment: number;
  totalPaid: number;
  totalInterest: number;
  rows: AmortizationRow[];
};

/** Cuota fija: P·i / (1 − (1 + i)^−n). Con tasa 0, P / n. */
export function fixedPayment(principal: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function frenchAmortization(params: {
  principal: number;
  /** Tasa anual en porcentaje (24 = 24 %). La mensual es anual / 12. */
  annualRatePercent: number;
  months: number;
  firstChargeOn: ISODate;
}): AmortizationSchedule {
  const { principal, annualRatePercent, months, firstChargeOn } = params;
  if (!(principal > 0)) {
    throw new DomainError("G2", "El capital debe ser mayor que 0");
  }
  if (!Number.isInteger(months) || months < 1) {
    throw new DomainError("F5", "Los meses deben ser un entero ≥ 1");
  }
  if (!(annualRatePercent >= 0)) {
    throw new DomainError("F5", "La tasa no puede ser negativa");
  }

  const rate = annualRatePercent / 100 / 12;
  const paymentCents = toCents(fixedPayment(principal, rate, months));
  const first = fromISODate(firstChargeOn);

  let balanceCents = toCents(principal);
  const rows: AmortizationRow[] = [];
  for (let i = 0; i < months; i++) {
    const interestCents = Math.round(balanceCents * rate);
    const isLast = i === months - 1;
    // La última cuota liquida exactamente el capital restante.
    const principalCents = isLast ? balanceCents : paymentCents - interestCents;
    balanceCents -= principalCents;
    rows.push({
      no: i + 1,
      occurred_on: toISODate(addMonthsClamped(first, i)),
      payment: fromCents(principalCents + interestCents),
      interest: fromCents(interestCents),
      principal: fromCents(principalCents),
      balance: fromCents(balanceCents),
    });
  }

  const totalPaidCents = rows.reduce((s, r) => s + toCents(r.payment), 0);
  return {
    payment: fromCents(paymentCents),
    totalPaid: fromCents(totalPaidCents),
    totalInterest: fromCents(totalPaidCents - toCents(principal)),
    rows,
  };
}
