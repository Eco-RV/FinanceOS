/**
 * Plan de un financiamiento sobre una tarjeta, con o sin interés (F1, F2, F5).
 *
 * - Tasa 0: el total se reparte en cuotas iguales en céntimos, con el residuo
 *   en la última (`installmentSchedule`, la regla de siempre).
 * - Con tasa: tabla de amortización francesa (`frenchAmortization`, la misma
 *   de los préstamos). Cada cuota = interés + abono al capital.
 *
 * En los dos casos el plan completo se guarda como cuotas (`expense` con fecha
 * futura). El **capital** resta al disponible desde el día 1; el **interés**
 * de una cuota solo cuenta cuando llega su fecha (ver `scheduledInterest`).
 */

import { DomainError } from "../shared/errors.ts";
import type { ISODate } from "../shared/calendar.ts";
import { fromCents, toCents, type Currency } from "../shared/money.ts";
import { frenchAmortization, segmentedAmortization, type PrepaymentMode } from "./amortization.ts";
import {
  installmentSchedule,
  MAX_FINANCING_MONTHS,
  MIN_FINANCING_MONTHS,
  splitByDate,
  type Installment,
} from "./installments.ts";

export const MAX_FINANCING_RATE = 100;

export type FinancingTerms = {
  /** Capital financiado (en tasa 0, el total de la compra). */
  principal: number;
  /** Tasa anual nominal en porcentaje (24 = 24 %); 0 = sin interés. */
  annualRatePercent: number;
  months: number;
  firstChargeOn: ISODate;
  currency: Currency;
};

export type FinancingInstallment = Installment & {
  /** Parte de la cuota que es interés (0 en tasa 0). */
  interest: number;
  /** Abono al capital. */
  principal: number;
  /** Capital que queda después de esta cuota. */
  balance: number;
};

/** F1/F5: capital > 0, tasa de 0 a 100 %, de 2 a 72 meses. */
export function validateFinancingTerms(terms: FinancingTerms): void {
  if (!(terms.principal > 0)) {
    throw new DomainError("G2", "El monto del financiamiento debe ser mayor que 0");
  }
  if (!(terms.annualRatePercent >= 0 && terms.annualRatePercent <= MAX_FINANCING_RATE)) {
    throw new DomainError("F5", `La tasa anual debe estar entre 0 y ${MAX_FINANCING_RATE} %`);
  }
  if (
    !Number.isInteger(terms.months) ||
    terms.months < MIN_FINANCING_MONTHS ||
    terms.months > MAX_FINANCING_MONTHS
  ) {
    throw new DomainError(
      "F1",
      `Los meses deben ser un entero entre ${MIN_FINANCING_MONTHS} y ${MAX_FINANCING_MONTHS}`,
    );
  }
}

/** Las cuotas del plan: única fuente de montos, fechas e intereses. */
export function financingSchedule(terms: FinancingTerms): FinancingInstallment[] {
  validateFinancingTerms(terms);
  const { principal, annualRatePercent, months, firstChargeOn, currency } = terms;

  if (annualRatePercent === 0) {
    let balanceCents = toCents(principal);
    return installmentSchedule({ totalAmount: principal, months, firstChargeOn, currency }).map(
      (c) => {
        balanceCents -= toCents(c.amount);
        return { ...c, interest: 0, principal: c.amount, balance: fromCents(balanceCents) };
      },
    );
  }

  return frenchAmortization({ principal, annualRatePercent, months, firstChargeOn }).rows.map(
    (r) => ({
      no: r.no,
      of: months,
      occurred_on: r.occurred_on,
      amount: r.payment,
      interest: r.interest,
      principal: r.principal,
      balance: r.balance,
    }),
  );
}

export type FinancingProgress = {
  installments: FinancingInstallment[];
  /** Cuotas cobradas: su fecha ya llegó (fecha ≤ hoy, M7). */
  charged: FinancingInstallment[];
  /** Cuotas programadas (fecha > hoy). */
  scheduled: FinancingInstallment[];
  next: FinancingInstallment | null;
  /** Capital que falta cobrar (después de la última cuota cobrada). */
  remainingPrincipal: number;
  interestCharged: number;
  interestPending: number;
  totalCost: number;
  totalInterest: number;
};

/** Avance de un plan a una fecha. Las cuotas se cobran en el estado de cuenta. */
export function financingProgress(
  installments: FinancingInstallment[],
  todayISO: ISODate,
): FinancingProgress {
  const { occurred: charged, scheduled } = splitByDate(installments, todayISO);
  const cents = (rows: FinancingInstallment[], key: "interest" | "amount" | "principal") =>
    rows.reduce((s, r) => s + toCents(r[key]), 0);
  const principalCents = cents(installments, "principal");
  return {
    installments,
    charged,
    scheduled,
    next: scheduled[0] ?? null,
    remainingPrincipal: fromCents(principalCents - cents(charged, "principal")),
    interestCharged: fromCents(cents(charged, "interest")),
    interestPending: fromCents(cents(scheduled, "interest")),
    totalCost: fromCents(cents(installments, "amount")),
    totalInterest: fromCents(cents(installments, "interest")),
  };
}

/**
 * Cuotas guardadas → plan. Las cuotas de un plan cancelado que ya no existen
 * (F4) no aparecen; el interés de cada una viaja con la cuota.
 */
export function storedInstallments(
  rows: { installment_no: number; occurred_on: ISODate; amount: number; interest_amount?: number | null }[],
  months: number,
  principalBefore: number,
): FinancingInstallment[] {
  let balanceCents = toCents(principalBefore);
  return [...rows]
    .sort((a, b) => a.installment_no - b.installment_no)
    .map((r) => {
      const interest = Number(r.interest_amount ?? 0);
      const principal = fromCents(toCents(r.amount) - toCents(interest));
      balanceCents -= toCents(principal);
      return {
        no: Number(r.installment_no),
        of: months,
        occurred_on: r.occurred_on,
        amount: Number(r.amount),
        interest,
        principal,
        balance: fromCents(balanceCents),
      };
    });
}

/**
 * Interés de cuotas programadas (fecha > hoy), por moneda. El saldo guardado
 * de la tarjeta incluye el plan completo; restarle esto deja la deuda de hoy:
 * capital de los financiamientos + interés de las cuotas ya cobradas.
 */
export function scheduledInterest(
  txns: { occurred_on: ISODate; interest_amount?: number | null; currency?: Currency }[],
  todayISO: ISODate,
): Partial<Record<Currency, number>> {
  const out: Partial<Record<Currency, number>> = {};
  for (const t of txns) {
    const interest = toCents(Number(t.interest_amount ?? 0));
    if (interest <= 0 || t.occurred_on <= todayISO) continue;
    const cur = t.currency ?? "CRC";
    out[cur] = fromCents(toCents(out[cur] ?? 0) + interest);
  }
  return out;
}

/** Cuota pendiente (programada, fecha > hoy) de un financiamiento. */
export type PendingInstallment = { no: number; occurred_on: ISODate; amount: number; interest: number };

/**
 * F11 (3.1.0): abono extraordinario al capital de un financiamiento. Las
 * cuotas programadas se reemplazan por un plan nuevo con el capital que queda
 * menos el abono: "term" conserva la cuota (menos cuotas), "payment" conserva
 * cuántas quedan (cuota menor). Mismas fechas: desde la próxima cuota, el
 * mismo día cada mes. Devuelve las cuotas nuevas (vacío si el abono cancela
 * todo lo pendiente).
 */
export function financingPrepaymentPlan(input: {
  pending: PendingInstallment[];
  annualRatePercent: number;
  amount: number;
  mode: PrepaymentMode;
}): { capitalPending: number; installments: FinancingInstallment[] } {
  const pending = [...input.pending].sort((a, b) => a.no - b.no);
  if (pending.length === 0) throw new DomainError("F11", "El financiamiento no tiene cuotas por cobrar");
  const capitalCents = pending.reduce((s, c) => s + toCents(c.amount) - toCents(c.interest), 0);
  if (!(toCents(input.amount) > 0)) throw new DomainError("F11", "El abono debe ser mayor que 0");
  if (toCents(input.amount) > capitalCents) {
    throw new DomainError("F11", "El abono no puede pasar el capital que falta");
  }
  const capitalPending = fromCents(capitalCents);
  if (toCents(input.amount) === capitalCents) return { capitalPending, installments: [] };

  const fromNo = pending[0].no;
  const schedule = segmentedAmortization({
    principal: capitalPending,
    annualRatePercent: input.annualRatePercent,
    months: pending.length,
    firstChargeOn: pending[0].occurred_on,
    events: [{ kind: "prepayment", afterNo: 0, amount: input.amount, mode: input.mode }],
  });
  const of = fromNo - 1 + schedule.rows.length;
  return {
    capitalPending,
    installments: schedule.rows.map((r) => ({
      no: fromNo - 1 + r.no,
      of,
      occurred_on: r.occurred_on,
      amount: r.payment,
      interest: r.interest,
      principal: r.principal,
      balance: r.balance,
    })),
  };
}
