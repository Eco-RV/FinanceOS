import { formatCurrency, formatDate } from "@/lib/format";
import type { Currency, MultiCurrencyStatement } from "@/domain";
import type { CreditCard } from "@/lib/types";

/** Saldos de la tarjeta por moneda (T1). Siempre la del límite; la otra solo si ≠ 0. */
export function cardBalances(card: CreditCard): { currency: Currency; amount: number }[] {
  const all = [
    { currency: "CRC" as Currency, amount: Number(card.current_balance) },
    { currency: "USD" as Currency, amount: Number(card.usd_balance ?? 0) },
  ];
  return all.filter((b) => b.currency === card.currency || b.amount !== 0);
}

export function CardBalances({ card }: { card: CreditCard }) {
  return (
    <>
      {cardBalances(card).map((b) => (
        <span key={b.currency} className="block">
          {formatCurrency(b.amount, b.currency)}
        </span>
      ))}
    </>
  );
}

/** Lo que falta pagar de contado, por moneda (solo monedas pendientes o atrasadas). */
export function owedByCurrency(m: MultiCurrencyStatement) {
  return m.currencies
    .map((currency) => ({ currency, st: m.byCurrency[currency]! }))
    .filter(({ st }) => st.status === "pendiente" || st.status === "atrasada");
}

export function CardOwed({ m }: { m: MultiCurrencyStatement }) {
  const owed = owedByCurrency(m);
  if (owed.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      {owed.map(({ currency, st }) => (
        <span key={currency} className="block">
          {formatCurrency(st.dueAmount, currency)}
          <span className="text-xs text-muted-foreground"> · {formatDate(st.dueDate)}</span>
        </span>
      ))}
    </>
  );
}

/** Días a la fecha límite de la moneda más urgente (para el badge de estado). */
export function urgentDaysToDue(m: MultiCurrencyStatement): number {
  const owed = owedByCurrency(m);
  const list = owed.length > 0 ? owed.map((o) => o.st) : m.currencies.map((c) => m.byCurrency[c]!);
  return Math.min(...list.map((st) => st.daysToDue));
}
