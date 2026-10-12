/**
 * Cuotas de un financiamiento sin interés (tasa 0): reparto en céntimos con el
 * residuo en la última cuota (F1) y el mismo día cada mes, ajustado en meses
 * cortos (F2). Es la única fuente de la regla: `create_financing_v2` solo
 * guarda este plan (el SP `create_financing` de 1.2.2, que la duplicaba en
 * SQL, se borra en `supabase/Versionamiento/2.1.0/00_drop_create_financing.sql`).
 */

import { DomainError } from "../shared/errors.ts";
import { addMonthsClamped, fromISODate, toISODate, type ISODate } from "../shared/calendar.ts";
import { amountOf, money, splitEvenly, type Currency } from "../shared/money.ts";

export const MIN_FINANCING_MONTHS = 2;
export const MAX_FINANCING_MONTHS = 48;

export type Installment = {
  /** Número de cuota, 1..N. */
  no: number;
  /** Total de cuotas. */
  of: number;
  occurred_on: ISODate;
  amount: number;
};

export function installmentSchedule(params: {
  totalAmount: number;
  months: number;
  firstChargeOn: ISODate;
  currency: Currency;
}): Installment[] {
  const { totalAmount, months, firstChargeOn, currency } = params;
  if (!(totalAmount > 0)) {
    throw new DomainError("G2", "El monto del financiamiento debe ser mayor que 0");
  }
  if (
    !Number.isInteger(months) ||
    months < MIN_FINANCING_MONTHS ||
    months > MAX_FINANCING_MONTHS
  ) {
    throw new DomainError(
      "F1",
      `Los meses deben ser un entero entre ${MIN_FINANCING_MONTHS} y ${MAX_FINANCING_MONTHS}`,
    );
  }

  const first = fromISODate(firstChargeOn);
  return splitEvenly(money(totalAmount, currency), months).map((part, i) => ({
    no: i + 1,
    of: months,
    occurred_on: toISODate(addMonthsClamped(first, i)),
    amount: amountOf(part),
  }));
}

/** Cuotas que ya ocurrieron (fecha ≤ hoy) vs. programadas (M7). */
export function splitByDate<T extends { occurred_on: ISODate }>(
  items: T[],
  todayISO: ISODate,
): { occurred: T[]; scheduled: T[] } {
  const occurred: T[] = [];
  const scheduled: T[] = [];
  for (const it of items) (it.occurred_on <= todayISO ? occurred : scheduled).push(it);
  return { occurred, scheduled };
}

/**
 * F4: al eliminar un financiamiento se conservan las cuotas que ya ocurrieron
 * (fecha ≤ hoy) y se borran las futuras. Si no queda ninguna, el plan se borra.
 */
export function financingCancellation<T extends { occurred_on: ISODate }>(
  installments: T[],
  todayISO: ISODate,
): { keep: T[]; remove: T[]; deletePlan: boolean } {
  const { occurred, scheduled } = splitByDate(installments, todayISO);
  return { keep: occurred, remove: scheduled, deletePlan: occurred.length === 0 };
}
