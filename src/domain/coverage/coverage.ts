/**
 * Cobertura: ¿alcanza el dinero de débito para los pagos de contado de las
 * tarjetas y las cuotas de préstamos? Antes vivía dentro de `dashboard/page.tsx`.
 *
 * Todo se lleva a la moneda de referencia (CRC). Desde 3.1.0 (G7), con un
 * tipo de cambio, lo que está en dólares (cuentas, tarjetas, préstamos) se
 * convierte y suma; sin tipo de cambio, lo de dólares se lista pero no suma.
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
  /** Monto en la moneda de referencia (CRC), o `null` si no hay tipo de cambio. */
  refAmount: number | null;
  /** Suma acumulada de pagos en la moneda de referencia hasta esta fila. */
  cumulative: number;
  covered: boolean;
};

export type Coverage<C, L = never> = {
  /** Débito disponible para pagar tarjetas y préstamos: cuentas corrientes (en CRC, G7). */
  availableDebit: number;
  /** Cuentas − tarjetas − capital de préstamos, en CRC (G7). */
  netWorth: number;
  /** Hay montos en dólares que no se sumaron por falta de tipo de cambio. */
  unconverted: boolean;
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
  /** G7 (3.1.0): colones por dólar; `null` = lo de dólares no suma. */
  usdCrc: number | null = null,
): Coverage<C, L> {
  let unconverted = false;
  /** Monto en CRC, o `null` si no se puede convertir. */
  const toRef = (amount: number, currency: string): number | null => {
    if (currency === COVERAGE_CURRENCY) return Number(amount);
    if (currency === "USD" && usdCrc && usdCrc > 0) return Math.round(Number(amount) * usdCrc * 100) / 100;
    if (Number(amount) !== 0) unconverted = true;
    return null;
  };
  const sumRef = (rows: { amount: number; currency: string }[]) =>
    rows.reduce((s, r) => s + (toRef(r.amount, r.currency) ?? 0), 0);

  const availableDebit = sumRef(
    accounts
      .filter((a) => a.type === "checking")
      .map((a) => ({ amount: Number(a.current_balance), currency: a.currency })),
  );

  const netWorth =
    sumRef(accounts.map((a) => ({ amount: Number(a.current_balance), currency: a.currency }))) -
    sumRef(cards.map(({ card }) => ({ amount: Number(card.current_balance), currency: card.currency }))) -
    sumRef(loans.map((l) => ({ amount: Number(l.remainingPrincipal), currency: l.currency })));

  type Pending = Omit<CoveragePayment<C, L>, "cumulative" | "covered" | "refAmount">;
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
    const refAmount = toRef(p.amount, p.currency);
    const cumulative = prev + (refAmount ?? 0);
    return [...rows, { ...p, refAmount, cumulative, covered: cumulative <= availableDebit } as CoveragePayment<C, L>];
  }, []);

  const total = (rows: CoveragePayment<C, L>[]) => rows.reduce((s, p) => s + (p.refAmount ?? 0), 0);

  const overdue = payments.filter((p) => p.overdue);
  const overdueTotal = total(overdue);
  const totalDue = total(payments);
  const dueSoon = total(payments.filter((p) => p.daysToDue <= DUE_SOON_DAYS));
  const newCharges = sumRef(cards.map(({ card, st }) => ({ amount: st.newCharges, currency: card.currency })));

  const coverageRatio =
    availableDebit > 0 ? Math.min(dueSoon / availableDebit, 1) : dueSoon > 0 ? 1 : 0;

  return {
    availableDebit,
    netWorth,
    unconverted,
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

/** Semáforo del faltante (2.5.0): verde cubierto, amarillo más adelante, rojo próximo. */
export type ShortfallLevel = "covered" | "later" | "soon";

export type Shortfall = {
  /** Lo que el débito no alcanza a cubrir de los pagos de contado (0 si alcanza). */
  amount: number;
  level: ShortfallLevel;
};

/**
 * Faltante para pagar de contado: lo que falta al débito disponible para
 * todos los pagos pendientes. Rojo si ya no alcanza para los de los próximos
 * `DUE_SOON_DAYS` días; amarillo si alcanza para esos pero no para todos.
 */
export function coverageShortfall(
  coverage: Pick<Coverage<unknown, unknown>, "availableDebit" | "totalDue" | "dueSoon">,
): Shortfall {
  const { availableDebit, totalDue, dueSoon } = coverage;
  const amount = Math.max(0, Math.round((totalDue - availableDebit) * 100) / 100);
  if (amount === 0) return { amount, level: "covered" };
  return { amount, level: dueSoon > availableDebit ? "soon" : "later" };
}
