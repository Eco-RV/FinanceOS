import { crToday } from "@/lib/dates";

const LOCALE = "es-CR";

export function formatCurrency(amount: number, currency = "CRC") {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function daysUntil(date: Date, from = crToday()) {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a - b) / 86_400_000);
}

/** "hace 2 días" / "hoy" / "mañana" / "en 5 días". */
export function relativeDayLabel(days: number): string {
  if (days < 0) return `hace ${-days} día${days === -1 ? "" : "s"}`;
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `en ${days} días`;
}
