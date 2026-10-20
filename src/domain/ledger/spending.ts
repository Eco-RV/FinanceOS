/**
 * Gastos por período (3.1.0). G9: los gastos en dólares suman en colones con
 * el último tipo de cambio; sin tipo de cambio, no suman y se indica. G10:
 * cada período se compara con el anterior equivalente.
 */

import { addDays, clampDay, fromISODate, toISODate, type ISODate } from "../shared/calendar.ts";
import { fromCents, toCents, type Currency } from "../shared/money.ts";

export type SpendingPoint = { d: ISODate; a: number; c: string | null; currency: Currency };
/** Un gasto ya en colones. */
export type RefPoint = { d: ISODate; a: number; c: string | null };

/** G9: lleva cada gasto a colones; los de dólares sin tipo de cambio quedan fuera. */
export function spendingInColones(
  points: SpendingPoint[],
  usdCrc: number | null,
): { points: RefPoint[]; unconverted: number } {
  const out: RefPoint[] = [];
  let unconverted = 0;
  for (const p of points) {
    if (p.currency === "CRC") out.push({ d: p.d, a: p.a, c: p.c });
    else if (usdCrc && usdCrc > 0) out.push({ d: p.d, a: fromCents(Math.round(toCents(p.a) * usdCrc)), c: p.c });
    else unconverted++;
  }
  return { points: out, unconverted };
}

export type SpendingPeriod = "week" | "month" | "year";
export type DateRange = { from: ISODate; to: ISODate };

/**
 * G10: el período actual (hasta hoy) y el anterior **equivalente**:
 * - semana: los 7 días previos;
 * - mes: del 1 al mismo día del mes anterior (recortado en meses cortos);
 * - año: del 1 de enero al mismo día del año anterior.
 */
export function spendingRanges(todayISO: ISODate): Record<SpendingPeriod, { current: DateRange; previous: DateRange }> {
  const today = fromISODate(todayISO);
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const iso = (yy: number, mm: number, dd: number) => toISODate(new Date(yy, mm, dd));
  const weekStart = addDays(today, -6);
  return {
    week: {
      current: { from: toISODate(weekStart), to: todayISO },
      previous: { from: toISODate(addDays(weekStart, -7)), to: toISODate(addDays(weekStart, -1)) },
    },
    month: {
      current: { from: iso(y, m, 1), to: todayISO },
      previous: { from: iso(y, m - 1, 1), to: iso(y, m - 1, clampDay(y, m - 1, d)) },
    },
    year: {
      current: { from: iso(y, 0, 1), to: todayISO },
      previous: { from: iso(y - 1, 0, 1), to: iso(y - 1, m, clampDay(y - 1, m, d)) },
    },
  };
}

export type SpendingComparison = {
  current: number;
  previous: number;
  /** current − previous. */
  delta: number;
  /** Cambio relativo (0.25 = +25 %), o null si el anterior fue 0. */
  ratio: number | null;
};

const within = (p: RefPoint, r: DateRange) => p.d >= r.from && p.d <= r.to;

/** G10: total del período y del anterior equivalente, con la variación. */
export function compareSpending(
  points: RefPoint[],
  range: { current: DateRange; previous: DateRange },
  category?: string | null,
): SpendingComparison {
  const sum = (r: DateRange) =>
    points
      .filter((p) => within(p, r) && (category === undefined || (p.c?.trim() || null) === category))
      .reduce((s, p) => s + toCents(p.a), 0);
  const cur = sum(range.current);
  const prev = sum(range.previous);
  return {
    current: fromCents(cur),
    previous: fromCents(prev),
    delta: fromCents(cur - prev),
    ratio: prev > 0 ? (cur - prev) / prev : null,
  };
}

/** El primer día que hace falta leer para comparar todos los períodos. */
export function spendingFrom(todayISO: ISODate): ISODate {
  const r = spendingRanges(todayISO);
  return [r.week.previous.from, r.month.previous.from, r.year.previous.from].sort()[0];
}
