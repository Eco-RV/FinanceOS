/**
 * Cobertura: ¿alcanza el dinero de débito para los pagos de contado de las
 * tarjetas y las cuotas de préstamos? Antes vivía dentro de `dashboard/page.tsx`.
 *
 * Por ahora solo cuenta la moneda de referencia (CRC): las tarjetas en otra
 * moneda se listan pero no suman (pendiente multimoneda con tipo de cambio).
 */

import type { CardStatement } from "../cards/statement.ts";
import type { LoanDue } from "../loans/loan.ts";
import { crToday, daysUntil, fromISODate } from "../shared/calendar.ts";
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

/**
 * Lo que entra a la cobertura: el pago de contado de una tarjeta (por
 * moneda) o la cuota de un préstamo (L4/L6).
 */
export type CoverageSource<C, L> =
  | { kind: "card"; card: C; st: CardStatement }
  | { kind: "loan"; loan: L; due: LoanDue };

export type CoveragePayment<C, L = never> = CoverageSource<C, L> & {
  currency: string;
  amount: number;
  dueDate: Date;
  /** Negativo si ya venció. */
  daysToDue: number;
  overdue: boolean;
  /** Suma acumulada de pagos (solo moneda de referencia) hasta esta fila. */
  cumulative: number;
  covered: boolean;
};

export type Coverage<C, L = never> = {
  /** Débito disponible para pagar tarjetas y préstamos: cuentas corrientes en CRC. */
  availableDebit: number;
  /** Suma naïve de todo (pendiente multimoneda): cuentas − tarjetas − capital de préstamos. */
  netWorth: number;
  /** Pagos pendientes o atrasados, del más urgente al de más tiempo. */
  payments: CoveragePayment<C, L>[];
  overdue: CoveragePayment<C, L>[];
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

export type CoverageLoan<L> = {
  loan: L;
  currency: string;
  /** Capital pendiente (resta del patrimonio). */
  remainingPrincipal: number;
  /** Cuota a cobro, o `null` si no hay una dentro del horizonte (L6). */
  due: LoanDue | null;
};

export function computeCoverage<C extends CoverageCard, L = never>(
  accounts: CoverageAccount[],
  cards: { card: C; st: CardStatement }[],
  loans: CoverageLoan<L>[] = [],
  today: Date = crToday(),
): Coverage<C, L> {
  const inRef = (currency: string) => currency === COVERAGE_CURRENCY;

  const availableDebit = accounts
    .filter((a) => a.type === "checking" && inRef(a.currency))
    .reduce((s, a) => s + Number(a.current_balance), 0);

  const netWorth =
    accounts.reduce((s, a) => s + Number(a.current_balance), 0) -
    cards.reduce((s, { card }) => s + Number(card.current_balance), 0) -
    loans.reduce((s, l) => s + Number(l.remainingPrincipal), 0);

  type Pending = Omit<CoveragePayment<C, L>, "cumulative" | "covered">;
  const cardDues: Pending[] = cards
    .filter(({ st }) => st.status === "pendiente" || st.status === "atrasada")
    .map(({ card, st }) => ({
      kind: "card",
      card,
      st,
      currency: card.currency,
      amount: st.dueAmount,
      dueDate: st.dueDate,
      daysToDue: st.daysToDue,
      overdue: st.status === "atrasada",
    }));
  const loanDues: Pending[] = loans.flatMap(({ loan, currency, due }) => {
    if (!due) return [];
    const dueDate = fromISODate(due.dueOn);
    return [
      {
        kind: "loan" as const,
        loan,
        due,
        currency,
        amount: due.amount,
        dueDate,
        daysToDue: daysUntil(dueDate, today),
        overdue: due.overdue,
      },
    ];
  });

  const pending = [...cardDues, ...loanDues].sort((a, b) => a.daysToDue - b.daysToDue);

  const payments = pending.reduce<CoveragePayment<C, L>[]>((rows, p) => {
    const prev = rows.at(-1)?.cumulative ?? 0;
    const cumulative = inRef(p.currency) ? prev + p.amount : prev;
    return [...rows, { ...p, cumulative, covered: cumulative <= availableDebit } as CoveragePayment<C, L>];
  }, []);

  const refPayments = payments.filter((p) => inRef(p.currency));
  const total = (rows: CoveragePayment<C, L>[]) => rows.reduce((s, p) => s + p.amount, 0);

  const overdue = payments.filter((p) => p.overdue);
  const overdueTotal = total(overdue.filter((p) => inRef(p.currency)));
  const totalDue = total(refPayments);
  const dueSoon = total(refPayments.filter((p) => p.daysToDue <= DUE_SOON_DAYS));
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
