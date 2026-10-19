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

/**
 * Cuántas cuotas de `payment` hacen falta para pagar `balance` a la tasa
 * mensual dada (la última puede ser menor). Si la cuota no alcanza ni para el
 * interés, devuelve `null`.
 */
export function remainingTerm(balance: number, monthlyRate: number, payment: number): number | null {
  if (!(balance > 0)) return 0;
  if (!(payment > 0)) return null;
  if (monthlyRate === 0) return Math.ceil(toCents(balance) / toCents(payment));
  const x = 1 - (balance * monthlyRate) / payment;
  if (x <= 0) return null;
  return Math.max(1, Math.ceil(-Math.log(x) / Math.log(1 + monthlyRate) - 1e-9));
}

/** Abono extraordinario al capital (L7/F11): baja el plazo o baja la cuota. */
export type PrepaymentMode = "term" | "payment";

/**
 * Cambio del plan a partir de un punto (3.0.1):
 * - `prepayment` después de la cuota `afterNo` (0 = antes de la primera).
 * - `rate` (L8, tasa variable): desde la cuota `fromNo`, nueva tasa anual; se
 *   mantiene el plazo que queda y se recalcula la cuota.
 */
export type AmortizationEvent =
  | { kind: "prepayment"; afterNo: number; amount: number; mode: PrepaymentMode }
  | { kind: "rate"; fromNo: number; annualRatePercent: number };

/**
 * F5 con cambios (3.0.1): la tabla francesa por tramos. Cada evento corta el
 * calendario y lo que sigue se recalcula con el capital que queda: un abono
 * baja el capital y, según el modo, conserva la cuota (menos cuotas) o el
 * plazo (cuota menor); un cambio de tasa conserva el plazo. Las fechas siguen
 * siendo el mismo día cada mes desde la primera cuota (F2).
 */
export function segmentedAmortization(params: {
  principal: number;
  annualRatePercent: number;
  months: number;
  firstChargeOn: ISODate;
  events?: AmortizationEvent[];
}): AmortizationSchedule {
  const events = [...(params.events ?? [])]
    .map((e, i) => ({ e, at: e.kind === "prepayment" ? e.afterNo : e.fromNo - 1, i }))
    .sort((a, b) => a.at - b.at || a.i - b.i);
  if (events.length === 0) return frenchAmortization(params);

  const first = fromISODate(params.firstChargeOn);
  const rows: AmortizationRow[] = [];
  let balance = params.principal;
  let annual = params.annualRatePercent;
  let remaining = params.months;
  let done = 0; // cuotas ya generadas
  let payment = frenchAmortization(params).payment;
  /** Tras un abono que baja el plazo, la cuota se mantiene exacta. */
  let keepPayment: number | null = null;
  let k = 0;

  const take = (upTo: number) => {
    // Genera cuotas desde done+1 hasta upTo (o hasta terminar) con lo de ahora.
    if (!(balance > 0) || remaining < 1) return;
    if (keepPayment !== null) {
      const rate = annual / 100 / 12;
      const payCents = toCents(keepPayment);
      let balanceCents = toCents(balance);
      while (done < upTo && balanceCents > 0) {
        const interestCents = Math.round(balanceCents * rate);
        const principalCents = Math.min(balanceCents, payCents - interestCents);
        balanceCents -= principalCents;
        rows.push({
          no: done + 1,
          occurred_on: toISODate(addMonthsClamped(first, done)),
          payment: fromCents(principalCents + interestCents),
          interest: fromCents(interestCents),
          principal: fromCents(principalCents),
          balance: fromCents(balanceCents),
        });
        done++;
        remaining = Math.max(0, remaining - 1);
      }
      balance = fromCents(balanceCents);
      return;
    }
    const seg = frenchAmortization({
      principal: balance,
      annualRatePercent: annual,
      months: remaining,
      firstChargeOn: toISODate(addMonthsClamped(first, done)),
    });
    payment = seg.payment;
    const count = Math.min(seg.rows.length, Math.max(0, upTo - done));
    for (let j = 0; j < count; j++) {
      const r = seg.rows[j];
      rows.push({ ...r, no: done + 1, occurred_on: toISODate(addMonthsClamped(first, done)) });
      done++;
      remaining--;
      balance = r.balance;
    }
  };

  while (k < events.length) {
    const at = events[k].at;
    take(at);
    if (!(balance > 0)) break;
    for (; k < events.length && events[k].at === at; k++) {
      const ev = events[k].e;
      if (ev.kind === "rate") {
        annual = ev.annualRatePercent;
        keepPayment = null;
      } else {
        const cut = Math.min(toCents(ev.amount), toCents(balance));
        balance = fromCents(toCents(balance) - cut);
        const term = ev.mode === "term" && balance > 0 ? remainingTerm(balance, annual / 100 / 12, payment) : null;
        if (term !== null) {
          remaining = term;
          keepPayment = payment;
        } else {
          keepPayment = null;
        }
      }
    }
  }
  take(Number.MAX_SAFE_INTEGER);

  const totalPaidCents = rows.reduce((s, r) => s + toCents(r.payment), 0);
  const totalPrincipalCents = rows.reduce((s, r) => s + toCents(r.principal), 0);
  return {
    payment: rows[0]?.payment ?? 0,
    totalPaid: fromCents(totalPaidCents),
    totalInterest: fromCents(totalPaidCents - totalPrincipalCents),
    rows,
  };
}
