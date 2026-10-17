/**
 * Ciclo de la tarjeta de crédito: corte, fecha límite de pago y estado de
 * cuenta del corte vigente (reglas T3–T7 de `docs/dominio/reglas.md`).
 */

import {
  clampDay,
  crToday,
  daysUntil,
  startOfDay,
  toISODate,
  type ISODate,
} from "../shared/calendar.ts";
import type { MovementType } from "../ledger/movement.ts";

/** Lo que el ciclo necesita de una tarjeta. */
export type CardCycle = {
  cutoff_day: number;
  payment_due_day: number;
  /**
   * T3 (2.8.0): los movimientos con fecha del día de corte entran al corte
   * SIGUIENTE (bancos que cortan por fecha de proceso, como BAC).
   */
  cutoff_day_rolls_over?: boolean | null;
};

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
  /**
   * Consumo posterior al corte que falta pagar (entra al próximo estado de
   * cuenta). Ya descuenta los abonos anticipados (`prepaid`).
   */
  newCharges: number;
  /**
   * Abonos anticipados (2.8.0): lo pagado después del corte por encima del
   * pago de contado, aplicado al consumo sin cortar.
   */
  prepaid: number;
  /** Deuda total según movimientos (Σ cargos − Σ pagos). */
  balanceByMovements: number;
  status: CardStatementStatus;
  /** Días hasta `dueDate`: > 0 faltan, <= 0 ya venció. */
  daysToDue: number;
};

export type StatementTxn = {
  type: MovementType;
  amount: number;
  occurred_on: ISODate;
};

/** `txns` = movimientos NO archivados de ESA tarjeta (expense, opening_balance y card_payment). */
export function cardStatement(
  card: CardCycle,
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
  // T3: con `cutoff_day_rolls_over`, el día de corte ya es del corte siguiente.
  const cutoffISO = toISODate(
    card.cutoff_day_rolls_over
      ? new Date(lastCutoff.getFullYear(), lastCutoff.getMonth(), lastCutoff.getDate() - 1)
      : lastCutoff,
  );
  const todayISO = toISODate(today);

  // "Después del corte" se parte en dos: lo que ya ocurrió (cuenta como
  // consumo/pago pendiente de cortar) y lo programado a futuro (p. ej. cuotas
  // de un financiamiento que aún no llegan a su fecha) — eso último no debe
  // aparecer todavía como "consumo sin cortar" ni afectar `dueAmount`, aunque
  // sí forma parte de `balanceByMovements` (la deuda total ya comprometida).
  let chargesThru = 0;
  let paymentsThru = 0;
  let chargesPosted = 0;
  let paymentsPosted = 0;
  let chargesFuture = 0;
  let paymentsFuture = 0;

  for (const t of txns) {
    const amount = Number(t.amount) || 0;
    // Un saldo inicial se trata como cargo en su fecha (con signo: negativo =
    // saldo a favor).
    const isExpense = t.type === "expense" || t.type === "opening_balance";
    const isPayment = t.type === "card_payment";
    if (!isExpense && !isPayment) continue;

    if (t.occurred_on <= cutoffISO) {
      if (isExpense) chargesThru += amount;
      else paymentsThru += amount;
    } else if (t.occurred_on <= todayISO) {
      if (isExpense) chargesPosted += amount;
      else paymentsPosted += amount;
    } else {
      if (isExpense) chargesFuture += amount;
      else paymentsFuture += amount;
    }
  }

  const statementBalance = Math.max(0, chargesThru - paymentsThru);
  const dueAmount = Math.max(0, statementBalance - paymentsPosted);
  // Lo pagado de más (saldo a favor al corte + abonos posteriores que superan
  // el pago de contado) se aplica al consumo sin cortar: gastar 20 000 y
  // abonar 20 000 el mismo día deja la tarjeta igual.
  const surplus = Math.max(0, paymentsThru + paymentsPosted - chargesThru);
  const prepaid = Math.min(Math.max(0, chargesPosted), surplus);
  const newCharges = Math.max(0, chargesPosted - prepaid);
  const balanceByMovements =
    chargesThru +
    chargesPosted +
    chargesFuture -
    paymentsThru -
    paymentsPosted -
    paymentsFuture;

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
    paidAfterCutoff: paymentsPosted,
    dueAmount,
    newCharges,
    prepaid,
    balanceByMovements,
    status,
    daysToDue,
  };
}
