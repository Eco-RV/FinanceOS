/**
 * Fechas de calendario (sin hora). Las fechas de negocio viajan como
 * `"YYYY-MM-DD"` (ISODate) o como `Date` a medianoche local.
 */

/** "YYYY-MM-DD". */
export type ISODate = string;

/** Zona horaria del negocio (G6): "hoy" es el día calendario en Costa Rica. */
export const BUSINESS_TIME_ZONE = "America/Costa_Rica";

/**
 * Día calendario actual en Costa Rica (UTC-6, sin horario de verano), como Date a
 * medianoche local. Úsalo como referencia de "hoy" en vez de `new Date()` para que
 * los cálculos no dependan de la zona horaria del servidor (Vercel corre en UTC).
 */
export function crToday(now: Date = new Date()): Date {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return fromISODate(s);
}

/** Una Date a "YYYY-MM-DD" usando sus componentes locales (no UTC). */
export function toISODate(d: Date): ISODate {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "YYYY-MM-DD" → Date a medianoche local. */
export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** T5: limita `day` al último día válido del mes (`month` base 0, puede desbordar). */
export function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

/** Fecha con día `day` en el mes `month` (base 0, puede desbordar), ajustada a meses cortos. */
export function dateInMonth(year: number, month: number, day: number): Date {
  return new Date(year, month, clampDay(year, month, day));
}

/** Misma fecha `n` meses después, conservando el día (ajustado a meses cortos). */
export function addMonthsClamped(date: Date, n: number): Date {
  return dateInMonth(date.getFullYear(), date.getMonth() + n, date.getDate());
}

/** Días de calendario de `from` a `date`: > 0 futuro, 0 hoy, < 0 pasado. */
export function daysUntil(date: Date, from: Date = crToday()): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a - b) / 86_400_000);
}

/** Misma hora `n` días después (o antes, con `n` negativo). */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}
