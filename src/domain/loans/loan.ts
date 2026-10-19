/**
 * Préstamos bancarios con interés (reglas F5 y L1–L5 en
 * `docs/dominio/reglas.md`).
 *
 * El calendario de cuotas no se guarda: se deriva siempre de los términos del
 * préstamo con la tabla de amortización francesa (cuota fija). Lo único que
 * se registra son los hechos: el desembolso (opcional, un ingreso) y cada
 * cuota pagada (un gasto con su número). El avance se calcula comparando el
 * calendario con los números de cuota pagados.
 */

import { DomainError } from "../shared/errors.ts";
import { daysUntil, fromISODate, type ISODate } from "../shared/calendar.ts";
import type { Currency } from "../shared/money.ts";
import { fromCents, toCents } from "../shared/money.ts";
import {
  segmentedAmortization,
  type AmortizationEvent,
  type AmortizationRow,
  type AmortizationSchedule,
  type PrepaymentMode,
} from "../financing/amortization.ts";

export const LOAN_MAX_MONTHS = 480;
export const LOAN_MAX_RATE = 100;

/** Categoría con la que se registran pagos y desembolso. */
export const LOAN_CATEGORY = "Préstamos";

export type LoanTerms = {
  principal: number;
  /** Tasa anual nominal en porcentaje (24 = 24 %). */
  annualRatePercent: number;
  months: number;
  firstPaymentOn: ISODate;
  currency: Currency;
  /** 3.0.1: abonos extraordinarios (L7) y cambios de tasa (L8), en orden. */
  adjustments?: AmortizationEvent[];
};

/** L1: capital > 0, tasa entre 0 y 100 %, de 1 a 480 meses. */
export function validateLoanTerms(terms: LoanTerms): void {
  if (!(terms.principal > 0)) {
    throw new DomainError("G2", "El monto del préstamo debe ser mayor que 0");
  }
  if (!(terms.annualRatePercent >= 0 && terms.annualRatePercent <= LOAN_MAX_RATE)) {
    throw new DomainError("L1", `La tasa anual debe estar entre 0 y ${LOAN_MAX_RATE} %`);
  }
  if (!Number.isInteger(terms.months) || terms.months < 1 || terms.months > LOAN_MAX_MONTHS) {
    throw new DomainError("L1", `El plazo debe ser de 1 a ${LOAN_MAX_MONTHS} meses`);
  }
}

/**
 * F5: calendario de cuotas (sistema francés) a partir de los términos y, desde
 * 3.0.1, de sus ajustes (abonos L7 y cambios de tasa L8), que lo recalculan
 * por tramos. Sigue sin guardarse: se deriva.
 */
export function loanSchedule(terms: LoanTerms): AmortizationSchedule {
  validateLoanTerms(terms);
  return segmentedAmortization({
    principal: terms.principal,
    annualRatePercent: terms.annualRatePercent,
    months: terms.months,
    firstChargeOn: terms.firstPaymentOn,
    events: terms.adjustments,
  });
}

/** Abonado extra al capital hasta (e incluido) el punto después de la cuota `paidCount`. */
function prepaidUpTo(terms: LoanTerms, paidCount: number): number {
  return fromCents(
    (terms.adjustments ?? []).reduce(
      (s, a) => s + (a.kind === "prepayment" && a.afterNo <= paidCount ? toCents(a.amount) : 0),
      0,
    ),
  );
}

/**
 * L7 (3.0.1): un abono extraordinario va después de la última cuota pagada,
 * es mayor que 0 y no pasa el capital que falta. El modo dice si baja el
 * plazo (misma cuota) o la cuota (mismo plazo).
 */
export function validateLoanPrepayment(
  progress: Pick<LoanProgress, "status" | "remainingPrincipal">,
  amount: number,
  mode: PrepaymentMode,
): void {
  if (progress.status === "pagado") throw new DomainError("L3", "El préstamo ya está pagado por completo");
  if (!(toCents(amount) > 0)) throw new DomainError("L7", "El abono debe ser mayor que 0");
  if (toCents(amount) > toCents(progress.remainingPrincipal)) {
    throw new DomainError("L7", "El abono no puede pasar el capital que falta");
  }
  if (mode !== "term" && mode !== "payment") throw new DomainError("L7", "Elige si baja el plazo o la cuota");
}

/**
 * L8 (3.0.1): tasa variable. La nueva tasa (0–100 %) rige desde una cuota que
 * todavía no se pagó; se mantiene el plazo que queda y se recalcula la cuota.
 */
export function validateLoanRateChange(
  progress: Pick<LoanProgress, "paidCount" | "status" | "schedule">,
  fromNo: number,
  annualRatePercent: number,
): void {
  if (progress.status === "pagado") throw new DomainError("L3", "El préstamo ya está pagado por completo");
  if (!(annualRatePercent >= 0 && annualRatePercent <= LOAN_MAX_RATE)) {
    throw new DomainError("L1", `La tasa anual debe estar entre 0 y ${LOAN_MAX_RATE} %`);
  }
  if (!Number.isInteger(fromNo) || fromNo <= progress.paidCount || fromNo > progress.schedule.rows.length) {
    throw new DomainError("L8", "La nueva tasa rige desde una cuota que todavía no se pagó");
  }
}

/**
 * Cantidad de cuotas pagadas en orden (1, 2, …, k). Las cuotas se pagan en
 * orden (L2), así que normalmente son todas; si por algún motivo hubiera un
 * hueco, el avance se cuenta hasta el hueco.
 */
export function paidInOrder(paidNos: Iterable<number>): number {
  const paid = new Set(paidNos);
  let k = 0;
  while (paid.has(k + 1)) k++;
  return k;
}

/**
 * L2/L3: la próxima cuota a pagar. Rechaza si el préstamo ya está pagado.
 */
export function nextInstallment(
  schedule: AmortizationSchedule,
  paidNos: Iterable<number>,
): AmortizationRow {
  const k = paidInOrder(paidNos);
  const next = schedule.rows[k];
  if (!next) throw new DomainError("L3", "El préstamo ya está pagado por completo");
  return next;
}

/**
 * L5: solo se deshace la última cuota pagada, para conservar el orden; y no
 * si después de ella hay un abono extraordinario (primero se deshace el abono).
 */
export function lastPaidInstallment(paidNos: Iterable<number>, adjustments: AmortizationEvent[] = []): number {
  const k = paidInOrder(paidNos);
  if (k === 0) throw new DomainError("L5", "El préstamo no tiene cuotas pagadas");
  if (adjustments.some((a) => a.kind === "prepayment" && a.afterNo >= k)) {
    throw new DomainError("L5", "Después de esa cuota hay un abono extraordinario: deshazlo primero");
  }
  return k;
}

export type LoanStatus = "al-dia" | "atrasado" | "pagado";

export type LoanProgress = {
  schedule: AmortizationSchedule;
  paidCount: number;
  /** Próxima cuota a pagar, o `null` si está pagado. */
  next: AmortizationRow | null;
  /** L4: cuotas con fecha anterior a hoy que no se han pagado. */
  overdue: AmortizationRow[];
  status: LoanStatus;
  /** Capital que falta (después de la última cuota pagada). */
  remainingPrincipal: number;
  principalPaid: number;
  interestPaid: number;
  interestPending: number;
};

/** Avance de un préstamo a una fecha (hoy en Costa Rica, G6). */
export function loanProgress(
  terms: LoanTerms,
  paidNos: Iterable<number>,
  todayISO: ISODate,
): LoanProgress {
  const schedule = loanSchedule(terms);
  const paidCount = paidInOrder(paidNos);
  const paidRows = schedule.rows.slice(0, paidCount);
  const pendingRows = schedule.rows.slice(paidCount);
  const sum = (rows: AmortizationRow[], key: "interest" | "principal") =>
    fromCents(rows.reduce((s, r) => s + toCents(r[key]), 0));

  const overdue = pendingRows.filter((r) => r.occurred_on < todayISO);
  const next = pendingRows[0] ?? null;

  return {
    schedule,
    paidCount,
    next,
    overdue,
    status: next === null ? "pagado" : overdue.length > 0 ? "atrasado" : "al-dia",
    // Capital − lo abonado en cuotas − lo abonado extra hasta hoy (L7).
    remainingPrincipal: fromCents(
      Math.max(0, toCents(terms.principal) - toCents(sum(paidRows, "principal")) - toCents(prepaidUpTo(terms, paidCount))),
    ),
    principalPaid: sum(paidRows, "principal"),
    interestPaid: sum(paidRows, "interest"),
    interestPending: sum(pendingRows, "interest"),
  };
}

/** L6: una cuota entra a "pagos próximos" si vence dentro de este plazo. */
export const LOAN_DUE_HORIZON_DAYS = 31;

/** Cuota a cobro de un préstamo, para el Resumen y la cobertura del débito. */
export type LoanDue = {
  /** Si hay atraso, la suma de las cuotas vencidas; si no, la próxima cuota. */
  amount: number;
  /** Vencimiento de la primera cuota que se cobra. */
  dueOn: ISODate;
  overdue: boolean;
  /** Números de cuota que suma `amount`. */
  installments: number[];
};

/**
 * L6: lo que hay que pagar de un préstamo. Con cuotas vencidas, su total (L4);
 * si no, la próxima cuota cuando vence dentro de `horizonDays`. `null` si está
 * pagado o la próxima cuota todavía está lejos (p. ej. un préstamo nuevo cuya
 * primera cuota es en meses).
 */
export function loanDue(
  progress: LoanProgress,
  todayISO: ISODate,
  horizonDays: number = LOAN_DUE_HORIZON_DAYS,
): LoanDue | null {
  if (progress.overdue.length > 0) {
    return {
      amount: fromCents(progress.overdue.reduce((s, r) => s + toCents(r.payment), 0)),
      dueOn: progress.overdue[0].occurred_on,
      overdue: true,
      installments: progress.overdue.map((r) => r.no),
    };
  }
  const next = progress.next;
  if (!next) return null;
  if (daysUntil(fromISODate(next.occurred_on), fromISODate(todayISO)) > horizonDays) return null;
  return { amount: next.payment, dueOn: next.occurred_on, overdue: false, installments: [next.no] };
}

/** Nota legible del pago de una cuota: "Cuota 3/12 · interés ₡… · capital ₡…". */
export function installmentNote(loanName: string, row: AmortizationRow, months: number): string {
  return `${loanName} · cuota ${row.no}/${months} (interés ${row.interest.toFixed(2)} · capital ${row.principal.toFixed(2)})`;
}
