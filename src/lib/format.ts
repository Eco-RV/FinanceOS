import { cache } from "react";

const LOCALE = "es-CR";

export function formatCurrency(amount: number, currency = "CRC") {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * U9 (3.1.0): formato de fecha elegido en Preferencias.
 *
 * 3.2.0: ya no es una variable del módulo (en el servidor la compartían los
 * requests de todos los usuarios). En el servidor vive en un almacén por
 * request (`cache` de React) que llena `getPreferences()` antes de pintar; en
 * los client components se pide con `useFormatDate()`
 * (`src/components/date-format.tsx`). Fuera de un request vale "corto".
 */
export type DateFormatChoice = "corto" | "numerico" | "largo";

const requestDateFormat = cache((): { choice: DateFormatChoice } => ({ choice: "corto" }));

/** Fija el formato de fecha del request en curso (solo servidor). */
export function setRequestDateFormat(choice: DateFormatChoice) {
  requestDateFormat().choice = choice;
}

const DATE_OPTIONS: Record<DateFormatChoice, Intl.DateTimeFormatOptions> = {
  corto: { day: "2-digit", month: "short", year: "numeric" },
  numerico: { day: "2-digit", month: "2-digit", year: "numeric" },
  largo: { day: "numeric", month: "long", year: "numeric" },
};

export function formatDate(date: Date | string, choice: DateFormatChoice = requestDateFormat().choice) {
  // Una fecha "YYYY-MM-DD" se interpreta como día calendario local, no UTC
  // (evita el corrimiento de un día en zonas al oeste de UTC).
  const value =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? (() => {
          const [y, m, d] = date.split("-").map(Number);
          return new Date(y, m - 1, d);
        })()
      : new Date(date);
  return new Intl.DateTimeFormat(LOCALE, DATE_OPTIONS[choice]).format(value);
}

/** "hace 2 días" / "hoy" / "mañana" / "en 5 días". */
export function relativeDayLabel(days: number): string {
  if (days < 0) return `hace ${-days} día${days === -1 ? "" : "s"}`;
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `en ${days} días`;
}
