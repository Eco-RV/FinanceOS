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
  // Una fecha "YYYY-MM-DD" se interpreta como día calendario local, no UTC
  // (evita el corrimiento de un día en zonas al oeste de UTC).
  const value =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? (() => {
          const [y, m, d] = date.split("-").map(Number);
          return new Date(y, m - 1, d);
        })()
      : new Date(date);
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
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
