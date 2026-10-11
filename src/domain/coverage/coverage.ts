/**
 * Cobertura: ¿alcanza el dinero de débito para los pagos de contado de las
 * tarjetas? Antes vivía dentro de `dashboard/page.tsx`.
 *
 * Por ahora solo cuenta la moneda de referencia (CRC): las tarjetas en otra
 * moneda se listan pero no suman (pendiente multimoneda con tipo de cambio).
 */

import type { CardStatement } from "../cards/statement.ts";
import type { Currency } from "../shared/money.ts";

export const COVERAGE_CURRENCY: Currency = "CRC";
/** Días hasta la fecha límite para considerar un pago "próximo". */
export const DUE_SOON_DAYS = 10;

export type CoverageAccount = {
  type: string;
  currency: string;
  current_balance: number;
};

export type CoverageCard = {
  currency: string;
  current_balance: number;
};

export type CoveragePayment<C> = {
  card: C;
  st: CardStatement;
  amount: number;
  /** Suma acumulada de pagos (solo moneda de referencia) hasta esta fila. */
  cumulative: number;
  covered: boolean;
};

export type Coverage<C> = {
  /** Débito disponible para pagar tarjetas: cuentas corrientes en CRC. */
  availableDebit: number;
  /** Suma naïve de todo (pendiente multimoneda). */
  netWorth: number;
  /** Tarjetas pendientes o atrasadas, de la más urgente a la de más tiempo. */
  payments: CoveragePayment<C>[];
  overdue: CoveragePayment<C>[];
  overdueTotal: number;
  totalDue: number;
  dueSoon: number;
  newCharges: number;
  coversSoon: boolean;
  /** Proporción del débito que se va en pagos próximos (0..1). */
  coverageRatio: number;
  /** Índice del primer pago que el débito ya no cubre (−1 si todos). */
  firstUncovered: number;
};

export function computeCoverage<C extends CoverageCard>(
  accounts: CoverageAccount[],
  cards: { card: C; st: CardStatement }[],
): Coverage<C> {
  const inRef = (currency: string) => currency === COVERAGE_CURRENCY;

  const availableDebit = accounts
    .filter((a) => a.type === "checking" && inRef(a.currency))
    .reduce((s, a) => s + Number(a.current_balance), 0);

  const netWorth =
    accounts.reduce((s, a) => s + Number(a.current_balance), 0) -
    cards.reduce((s, { card }) => s + Number(card.current_balance), 0);

  const pending = cards
    .filter(({ st }) => st.status === "pendiente" || st.status === "atrasada")
    .sort((a, b) => a.st.daysToDue - b.st.daysToDue);

  const payments = pending.reduce<CoveragePayment<C>[]>((rows, p) => {
    const prev = rows.at(-1)?.cumulative ?? 0;
    const amount = p.st.dueAmount;
    const cumulative = inRef(p.card.currency) ? prev + amount : prev;
    return [...rows, { ...p, amount, cumulative, covered: cumulative <= availableDebit }];
  }, []);

  const refPayments = payments.filter((p) => inRef(p.card.currency));
  const total = (rows: CoveragePayment<C>[]) => rows.reduce((s, p) => s + p.amount, 0);

  const overdue = payments.filter((p) => p.st.status === "atrasada");
  const overdueTotal = total(overdue.filter((p) => inRef(p.card.currency)));
  const totalDue = total(refPayments);
  const dueSoon = total(refPayments.filter((p) => p.st.daysToDue <= DUE_SOON_DAYS));
  const newCharges = cards
    .filter(({ card }) => inRef(card.currency))
    .reduce((s, { st }) => s + st.newCharges, 0);

  const coverageRatio =
    availableDebit > 0 ? Math.min(dueSoon / availableDebit, 1) : dueSoon > 0 ? 1 : 0;

  return {
    availableDebit,
    netWorth,
    payments,
    overdue,
    overdueTotal,
    totalDue,
    dueSoon,
    newCharges,
    coversSoon: availableDebit >= dueSoon,
    coverageRatio,
    firstUncovered: payments.findIndex((p) => !p.covered),
  };
}
