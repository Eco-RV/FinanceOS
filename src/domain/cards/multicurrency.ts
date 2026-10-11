/**
 * Tarjeta bimoneda (T1, T2): una tarjeta lleva un saldo y un estado de cuenta
 * por moneda, con un único límite en la moneda del límite (en Costa Rica,
 * normalmente colones). El disponible convierte los saldos en otra moneda con
 * un tipo de cambio explícito (G3).
 */

import { crToday, type ISODate } from "../shared/calendar.ts";
import { DomainError } from "../shared/errors.ts";
import {
  amountOf,
  convert,
  CURRENCIES,
  money,
  type Currency,
} from "../shared/money.ts";
import type { CurrencyBalances } from "../ledger/movement.ts";
import {
  cardStatement,
  type CardCycle,
  type CardStatement,
  type CardStatementStatus,
  type StatementTxn,
} from "./statement.ts";

/** Gravedad de cada estado, para resumir varias monedas en uno. */
const SEVERITY: Record<CardStatementStatus, number> = {
  "sin-movimientos": 0,
  "sin-saldo": 1,
  "al-dia": 2,
  pendiente: 3,
  atrasada: 4,
};

export type CurrencyStatementTxn = StatementTxn & { currency?: Currency };

export type MultiCurrencyStatement = {
  /** Estado de cuenta por moneda: siempre la del límite, más las que tengan movimientos. */
  byCurrency: Partial<Record<Currency, CardStatement>>;
  /** Monedas presentes, la del límite primero. */
  currencies: Currency[];
  /** El estado más grave entre monedas (una moneda atrasada atrasa la tarjeta). */
  status: CardStatementStatus;
};

export function cardStatementsByCurrency(
  card: CardCycle & { currency: Currency },
  txns: CurrencyStatementTxn[],
  from: Date = crToday(),
): MultiCurrencyStatement {
  const present = new Set<Currency>([card.currency]);
  for (const t of txns) present.add(t.currency ?? "CRC");
  const currencies = [card.currency, ...CURRENCIES.filter((c) => c !== card.currency && present.has(c))];

  const byCurrency: Partial<Record<Currency, CardStatement>> = {};
  let status: CardStatementStatus = "sin-movimientos";
  for (const cur of currencies) {
    const st = cardStatement(
      card,
      txns.filter((t) => (t.currency ?? "CRC") === cur),
      from,
    );
    byCurrency[cur] = st;
    if (SEVERITY[st.status] > SEVERITY[status]) status = st.status;
  }
  return { byCurrency, currencies, status };
}

/** Tipo de cambio digitado por el usuario: colones por 1 dólar, en una fecha. */
export type ExchangeRate = { usd_crc: number; rate_on: ISODate };

/** Unidades de `to` por 1 de `from` según un tipo de cambio USD→CRC. */
export function rateBetween(from: Currency, to: Currency, rate: ExchangeRate | null): number | null {
  if (from === to) return 1;
  if (!rate || !(rate.usd_crc > 0)) return null;
  if (from === "USD" && to === "CRC") return rate.usd_crc;
  if (from === "CRC" && to === "USD") return 1 / rate.usd_crc;
  return null;
}

export function validateExchangeRate(usdCrc: number): void {
  if (!(Number.isFinite(usdCrc) && usdCrc > 0)) {
    throw new DomainError("T2", "El tipo de cambio debe ser mayor que 0");
  }
}

export type CardAvailability = {
  /** Deuda total expresada en la moneda del límite, o `null` si falta tipo de cambio. */
  used: number | null;
  /** Límite − deuda, o `null` si no hay límite o falta tipo de cambio. */
  available: number | null;
  /** Hay saldo en otra moneda y no hay tipo de cambio para convertirlo. */
  missingRate: boolean;
};

/**
 * T2: disponible = límite − Σ saldos convertidos a la moneda del límite. Un
 * saldo negativo (a favor) en una moneda también cuenta.
 */
export function cardAvailability(params: {
  creditLimit: number | null;
  limitCurrency: Currency;
  balances: CurrencyBalances;
  rate: ExchangeRate | null;
}): CardAvailability {
  const { creditLimit, limitCurrency, balances, rate } = params;
  let usedCents = 0;
  for (const [cur, amount] of Object.entries(balances) as [Currency, number][]) {
    if (!amount) continue;
    const r = rateBetween(cur, limitCurrency, rate);
    if (r === null) return { used: null, available: null, missingRate: true };
    usedCents += convert(money(amount, cur), limitCurrency, r).cents;
  }
  const used = usedCents / 100;
  const available =
    creditLimit == null ? null : amountOf(money(creditLimit - used, limitCurrency));
  return { used, available, missingRate: false };
}
