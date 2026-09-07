/** Helpers to project the next cutoff ("corte") and payment due date of a card. */

import { crToday, toISODate } from "@/lib/dates";
import { daysUntil } from "@/lib/format";
import type { CreditCard, Transaction } from "@/lib/types";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Clamps `day` to the last valid day of the given year/month. */
function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

/** Next occurrence of `cutoffDay` on or after today. */
export function nextCutoffDate(cutoffDay: number, from = crToday()): Date {
  const today = startOfDay(from);
  const year = today.getFullYear();
  let month = today.getMonth();

  let candidate = new Date(year, month, clampDay(year, month, cutoffDay));
  if (candidate < today) {
    month += 1;
    candidate = new Date(year, month, clampDay(year, month, cutoffDay));
  }
  return candidate;
}

/**
 * Next payment due date. Assumes the payment falls after the corresponding
 * cutoff: if `paymentDueDay` is not after `cutoffDay`, it lands the next month.
 */
export function nextPaymentDate(
  cutoffDay: number,
  paymentDueDay: number,
  from = crToday(),
): Date {
  const cutoff = nextCutoffDate(cutoffDay, from);
  return paymentDueForCutoff(cutoff, cutoffDay, paymentDueDay);
}

/** Último corte ya ocurrido (la fecha de corte más reciente <= hoy). */
export function lastCutoffDate(cutoffDay: number, from = crToday()): Date {
  const today = startOfDay(from);
  const year = today.getFullYear();
  let month = today.getMonth();

  let candidate = new Date(year, month, clampDay(year, month, cutoffDay));
  if (candidate > today) {
    month -= 1;
    candidate = new Date(year, month, clampDay(year, month, cutoffDay));
  }
  return candidate;
}

/**
 * Fecha límite de pago que corresponde a un corte dado: mismo mes si el día de
 * pago cae después del día de corte, si no el mes siguiente.
 */
export function paymentDueForCutoff(
  cutoff: Date,
  cutoffDay: number,
  paymentDueDay: number,
): Date {
  const monthOffset = paymentDueDay > cutoffDay ? 0 : 1;
  const year = cutoff.getFullYear();
  const month = cutoff.getMonth() + monthOffset;
  return new Date(year, month, clampDay(year, month, paymentDueDay));
}

// ─────────────────────  estado de cuenta (corte vigente)  ─────────────────────

export type CardStatementStatus =
  | "sin-movimientos"
  | "sin-saldo"
  | "al-dia"
  | "pendiente"
  | "atrasada";

export type CardStatement = {
  /** Fecha del último corte. */
  lastCutoff: Date;
  /** Fecha límite para pagar ese corte sin generar intereses. */
  dueDate: Date;
  /** Saldo de contado al corte (cargos − pagos hasta la fecha de corte). */
  statementBalance: number;
  /** Pagos aplicados después del corte. */
  paidAfterCutoff: number;
  /** Lo que falta pagar del corte antes de `dueDate`. */
  dueAmount: number;
  /** Consumo posterior al corte (entra al próximo estado de cuenta). */
  newCharges: number;
  /** Deuda total según movimientos (Σ cargos − Σ pagos). */
  balanceByMovements: number;
  status: CardStatementStatus;
  /** Días hasta `dueDate`: > 0 faltan, <= 0 ya venció. */
  daysToDue: number;
};

type StatementTxn = Pick<Transaction, "type" | "amount" | "occurred_on">;

/** `txns` = movimientos NO archivados de ESA tarjeta (expense + card_payment). */
export function cardStatement(
  card: Pick<CreditCard, "cutoff_day" | "payment_due_day">,
  txns: StatementTxn[],
  from = crToday(),
): CardStatement {
  const today = startOfDay(from);
  const lastCutoff = lastCutoffDate(card.cutoff_day, today);
  const dueDate = paymentDueForCutoff(
    lastCutoff,
    card.cutoff_day,
    card.payment_due_day,
  );
  const cutoffISO = toISODate(lastCutoff);

  let chargesThru = 0;
  let paymentsThru = 0;
  let chargesAfter = 0;
  let paymentsAfter = 0;

  for (const t of txns) {
    const amount = Number(t.amount) || 0;
    const beforeOrAtCutoff = t.occurred_on <= cutoffISO;
    if (t.type === "expense") {
      if (beforeOrAtCutoff) chargesThru += amount;
      else chargesAfter += amount;
    } else if (t.type === "card_payment") {
      if (beforeOrAtCutoff) paymentsThru += amount;
      else paymentsAfter += amount;
    }
  }

  const statementBalance = Math.max(0, chargesThru - paymentsThru);
  const dueAmount = Math.max(0, statementBalance - paymentsAfter);
  const balanceByMovements =
    chargesThru + chargesAfter - paymentsThru - paymentsAfter;

  const daysToDue = daysUntil(dueDate, today);

  let status: CardStatementStatus;
  if (txns.length === 0) status = "sin-movimientos";
  else if (statementBalance <= 0.005) status = "sin-saldo";
  else if (dueAmount <= 0.005) status = "al-dia";
  else if (daysToDue < 0) status = "atrasada";
  else status = "pendiente";

  return {
    lastCutoff,
    dueDate,
    statementBalance,
    paidAfterCutoff: paymentsAfter,
    dueAmount,
    newCharges: chargesAfter,
    balanceByMovements,
    status,
    daysToDue,
  };
}
