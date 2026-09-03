/** Helpers to project the next cutoff ("corte") and payment due date of a card. */

import { crToday } from "@/lib/dates";

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
  const monthOffset = paymentDueDay > cutoffDay ? 0 : 1;
  const year = cutoff.getFullYear();
  const month = cutoff.getMonth() + monthOffset;
  return new Date(year, month, clampDay(year, month, paymentDueDay));
}
