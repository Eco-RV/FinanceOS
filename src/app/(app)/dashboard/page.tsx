import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  CircleGauge,
  CreditCard,
  Layers,
  ShieldAlert,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, relativeDayLabel } from "@/lib/format";
import {
  availabilityLevel,
  buildReminders,
  minimumPaymentStatus,
  cardAvailability,
  cardStatementsByCurrency,
  computeCoverage,
  coverageShortfall,
  financingProgress,
  isCurrency,
  crToday,
  daysUntil,
  loanDue,
  loanProgress,
  nextCutoffDate,
  rateBetween,
  storedInstallments,
  toISODate,
  type AvailabilityLevel,
  type CardStatement,
  type CoverageLoan,
  type CoveragePayment,
  type Currency,
  type ShortfallLevel,
} from "@/domain";
import { termsOf } from "@/application";
import { loadLoanAdjustments } from "@/lib/loan-adjustments";
import { interestByCard, withoutScheduledInterest } from "@/lib/card-balances";
import { loadFinancingBoard } from "@/lib/financing-board";
import { loadSharedBoard } from "@/lib/shared-board";
import { ensureExchangeRateToday, ensurePlansUpToDate } from "@/lib/sync-plans";
import { categoryOptions, iconsByName } from "@/lib/categories";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import type {
  Account,
  Category,
  CreditCard as CreditCardType,
  Financing,
  Loan,
  Transaction,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/panel";
import { LinkChevron } from "@/components/link-pending";
import { FOCUS_OUTLINE, PRESSABLE_ROW, PRESSABLE_SURFACE } from "@/lib/interactive";
import { cn } from "@/lib/utils";
import { StatBody, StatDialog, type StatTone } from "./stat-dialog";
import { ExpenseOverview, type ExpensePoint } from "./expense-overview";
import { PlansAndGoals } from "./plans-goals";
import { Reminders } from "./reminders";
import { loadPlansBoard } from "@/lib/plans-board";
import { repositories } from "@/infrastructure/container";
import type { Goal } from "@/application";
import { allRows } from "@/lib/supabase/all-rows";

type Level = "overdue" | "urgent" | "soon" | "ok";

function levelFor(days: number, overdue: boolean): Level {
  if (overdue) return "overdue";
  if (days <= 0) return "overdue";
  if (days <= 3) return "urgent";
  if (days <= 10) return "soon";
  return "ok";
}

const LEVEL_BORDER: Record<Level, string> = {
  overdue: "border-l-destructive",
  urgent: "border-l-destructive/60",
  soon: "border-l-amber-500",
  ok: "border-l-border",
};

const LEVEL_BAR: Record<Level, string> = {
  overdue: "bg-destructive",
  urgent: "bg-destructive/70",
  soon: "bg-amber-500",
  ok: "bg-muted-foreground/30",
};

/** Semáforo del disponible de crédito (verde / amarillo / rojo). */
const AVAILABILITY_BAR: Record<AvailabilityLevel, string> = {
  high: "bg-success",
  medium: "bg-warning",
  low: "bg-destructive",
};
const AVAILABILITY_TONE: Record<AvailabilityLevel, StatTone> = {
  high: "positive",
  medium: "warning",
  low: "negative",
};

const SHORTFALL_TONE: Record<ShortfallLevel, StatTone> = {
  covered: "positive",
  later: "warning",
  soon: "negative",
};

type Payment = CoveragePayment<CreditCardType, Loan>;

type CardTxn = Pick<
  Transaction,
  "card_id" | "type" | "amount" | "occurred_on" | "financing_id" | "currency" | "interest_amount"
>;

type Installment = Pick<
  Transaction,
  "financing_id" | "installment_no" | "occurred_on" | "amount" | "interest_amount"
>;

/** Retraso de entrada en cascada de cada bloque de la grilla. */
const rise = (i: number) => ({ "--rise-i": i }) as CSSProperties;

export default async function DashboardPage() {
  await requireUser();
  await Promise.all([ensurePlansUpToDate(), ensureExchangeRateToday()]);

  const today = crToday();
  const todayISO = toISODate(today);
  const yearStartISO = `${todayISO.slice(0, 4)}-01-01`;
  // Para "últimos 7 días" a inicios de enero hace falta el final del año anterior.
  const sinceISO = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
  const expensesFrom = sinceISO < yearStartISO ? sinceISO : yearStartISO;

  const supabase = await createClient();
  const [
    { data: accountsData },
    { data: cardsData },
    { data: cardTxData },
    { data: expenseData },
    { data: financingData },
    { data: installmentData },
    { data: loanData },
    { data: loanPayData },
    { data: categoryData },
    { data: rateData },
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("archived", false),
    supabase.from("credit_cards").select("*").eq("archived", false),
    // Todas las filas (paginado): con muchas cuotas se pasa del tope de ~1000.
    allRows<CardTxn>((from, to) =>
      supabase
        .from("transactions")
        .select("card_id, type, amount, occurred_on, financing_id, currency, interest_amount")
        .eq("archived", false)
        .not("card_id", "is", null)
        .order("id")
        .range(from, to),
    ).then((data) => ({ data })),
    supabase
      .from("transactions")
      .select("amount, occurred_on, category, currency")
      .eq("type", "expense")
      .eq("archived", false)
      .gte("occurred_on", expensesFrom)
      .lte("occurred_on", todayISO),
    supabase.from("financings").select("*").eq("archived", false).is("cancelled_on", null),
    supabase
      .from("transactions")
      .select("financing_id, installment_no, occurred_on, amount, interest_amount")
      .eq("archived", false)
      .not("financing_id", "is", null)
      .not("installment_no", "is", null),
    supabase.from("loans").select("*").eq("archived", false),
    supabase
      .from("transactions")
      .select("loan_id, installment_no")
      .not("loan_id", "is", null)
      .not("installment_no", "is", null)
      .eq("archived", false),
    supabase.from("categories").select("*").eq("kind", "expense").eq("archived", false),
    supabase
      .from("exchange_rates")
      .select("rate_on, usd_crc")
      .eq("archived", false)
      .order("rate_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // F8: avisos de cuota por enviar y lo que los miembros deben de cuotas cobradas.
  // 2.7.0: planes (línea base y programados) y metas de ahorro.
  // 3.0.1: también los gastos compartidos (X5).
  const [board, sharedBoard, plansBoard, { data: goalData }, estimated, { data: minimumData }] = await Promise.all([
    loadFinancingBoard(supabase, todayISO),
    loadSharedBoard(supabase, todayISO),
    repositories().then((repos) => loadPlansBoard(supabase, repos, todayISO, { upcomingDays: 15 })),
    supabase
      .from("savings_goals")
      .select("id, name, target_amount, currency, target_date, account_id, icon, archived")
      .eq("archived", false),
    // P8 (3.0.1): montos por confirmar (P7) y pagos mínimos digitados (T8).
    repositories().then((repos) => repos.plans.estimatedOccurrences()),
    supabase.from("card_minimum_payments").select("card_id, cutoff_on, currency, amount"),
  ]);
  const goals = (goalData ?? []) as Goal[];
  const noticesToSend =
    board.groups.filter((g) => g.needsNotice).length + sharedBoard.groups.filter((g) => g.needsNotice).length;
  const receivableCrc = [...board.receivables, ...sharedBoard.receivables]
    .filter((r) => r.currency === "CRC")
    .reduce((s, r) => s + r.total, 0);

  const accounts = (accountsData ?? []) as Account[];
  const cardTxns = (cardTxData ?? []) as CardTxn[];
  // F5: solo el capital de los financiamientos cuenta desde el día 1.
  const interest = interestByCard(cardTxns, todayISO);
  const cards = ((cardsData ?? []) as CreditCardType[]).map((c) =>
    withoutScheduledInterest(c, interest),
  );
  const cardName = new Map(cards.map((c) => [c.id, c.name]));
  const loans = (loanData ?? []) as Loan[];
  const rate = rateData
    ? { rate_on: rateData.rate_on as string, usd_crc: Number(rateData.usd_crc) }
    : null;

  // Financiamientos activos: los que todavía tienen cuotas por cobrar.
  const installments = (installmentData ?? []) as Installment[];
  const financings = ((financingData ?? []) as Financing[])
    .map((f) => {
      const cuotas = installments
        .filter((t) => t.financing_id === f.id)
        .map((t) => ({ ...t, installment_no: Number(t.installment_no) }));
      const p = financingProgress(
        storedInstallments(cuotas, f.months, Number(f.total_amount)),
        todayISO,
      );
      return { f, p };
    })
    .filter(({ p }) => p.next)
    .sort((a, b) => a.p.next!.occurred_on.localeCompare(b.p.next!.occurred_on));

  // L6: cuota a cobro de cada préstamo (vencidas, o la próxima dentro de 31 días).
  const paidByLoan = new Map<string, number[]>();
  for (const p of (loanPayData ?? []) as { loan_id: string; installment_no: number }[]) {
    paidByLoan.set(p.loan_id, [...(paidByLoan.get(p.loan_id) ?? []), Number(p.installment_no)]);
  }
  const loanAdjustments = await loadLoanAdjustments(supabase);
  const loanEntries: CoverageLoan<Loan>[] = loans.map((loan) => {
    const currency = loan.currency === "USD" ? "USD" : "CRC";
    const progress = loanProgress(
      termsOf({ ...loan, currency }, loanAdjustments.get(loan.id) ?? []),
      paidByLoan.get(loan.id) ?? [],
      todayISO,
    );
    return {
      loan,
      currency,
      remainingPrincipal: progress.remainingPrincipal,
      due: loanDue(progress, todayISO),
    };
  });
  const loanPrincipalCrc = loanEntries
    .filter((l) => l.currency === "CRC")
    .reduce((s, l) => s + l.remainingPrincipal, 0);

  // Gastos en colones ya ocurridos (para las cards de período y el gráfico).
  const expenseRows = (expenseData ?? []) as Pick<
    Transaction,
    "amount" | "occurred_on" | "category" | "currency"
  >[];
  const expensePoints: ExpensePoint[] = expenseRows
    .filter((t) => t.currency !== "USD")
    .map((t) => ({ d: t.occurred_on, a: Number(t.amount), c: t.category }));
  const categoryIcons = iconsByName(
    categoryOptions((categoryData ?? []) as Category[], EXPENSE_CATEGORIES),
  );

  // Capital por cobrar de los financiamientos (sin el interés futuro).
  const financingPending = cardTxns
    .filter((t) => t.financing_id && t.occurred_on > todayISO && t.currency !== "USD")
    .reduce((s, t) => s + Number(t.amount) - Number(t.interest_amount ?? 0), 0);

  const txByCard = new Map<string, CardTxn[]>();
  for (const t of cardTxns) {
    if (!t.card_id) continue;
    const list = txByCard.get(t.card_id);
    if (list) list.push(t);
    else txByCard.set(t.card_id, [t]);
  }

  // T1: un estado de cuenta por moneda de cada tarjeta.
  const multiByCard = new Map(
    cards.map((c) => [
      c.id,
      cardStatementsByCurrency(
        { ...c, currency: isCurrency(c.currency) ? c.currency : "CRC" },
        (txByCard.get(c.id) ?? []).map((t) => ({
          ...t,
          currency: isCurrency(t.currency) ? t.currency : "CRC",
        })),
        today,
      ),
    ]),
  );
  // Cada moneda de cada tarjeta entra como un "pago" aparte, con el saldo de
  // esa moneda: la cobertura solo suma los de CRC (ver computeCoverage).
  const cardEntries = cards.flatMap((card) => {
    const multi = multiByCard.get(card.id)!;
    return multi.currencies.map((cur) => ({
      card: {
        ...card,
        currency: cur,
        current_balance: cur === "USD" ? Number(card.usd_balance ?? 0) : Number(card.current_balance),
      },
      st: multi.byCurrency[cur]!,
    }));
  });

  // Cobertura del débito contra los pagos de contado: regla de dominio.
  // G7 (3.0.1): lo de dólares se convierte con el último tipo de cambio.
  const coverage = computeCoverage(accounts, cardEntries, loanEntries, today, rate?.usd_crc ?? null);
  const {
    availableDebit,
    netWorth,
    unconverted,
    payments,
    overdue,
    overdueTotal,
    totalDue: totalCrcDue,
    newCharges: newChargesCrc,
    firstUncovered,
  } = coverage;
  const shortfall = coverageShortfall(coverage);

  // Liquidez: las cuentas de débito en colones con saldo (sin efectivo ni ahorro).
  const liquidAccounts = accounts
    .filter((a) => a.type === "checking" && a.currency === "CRC" && Number(a.current_balance) > 0)
    .sort((a, b) => Number(b.current_balance) - Number(a.current_balance));

  // Consumo sin cortar por tarjeta y moneda.
  const unbilled = cardEntries
    .filter(({ st }) => st.newCharges > 0)
    .map(({ card, st }) => ({ card, st, cutoff: nextCutoffDate(card.cutoff_day, today) }))
    .sort((a, b) => b.st.newCharges - a.st.newCharges);

  // T2: disponible real de cada tarjeta (límite − saldos, con financiamientos).
  const credit = cards
    .map((card) => {
      const limit = card.credit_limit != null ? Number(card.credit_limit) : null;
      const limitCurrency: Currency = isCurrency(card.currency) ? card.currency : "CRC";
      const av = cardAvailability({
        creditLimit: limit,
        limitCurrency,
        balances: { CRC: Number(card.current_balance), USD: Number(card.usd_balance ?? 0) },
        rate,
      });
      return { card, limit, limitCurrency, av, level: availabilityLevel(av.available, limit) };
    })
    .sort((a, b) => (a.level?.ratio ?? 2) - (b.level?.ratio ?? 2));
  const toCrc = (amount: number, cur: Currency) => {
    const r = rateBetween(cur, "CRC", rate);
    return r == null ? null : amount * r;
  };
  let creditAvailableCrc = 0;
  let creditLimitCrc = 0;
  let creditSkipped = 0;
  for (const c of credit) {
    if (c.limit == null || c.av.available == null) {
      if (c.limit != null) creditSkipped++;
      continue;
    }
    const available = toCrc(c.av.available, c.limitCurrency);
    const limit = toCrc(c.limit, c.limitCurrency);
    if (available == null || limit == null) {
      creditSkipped++;
      continue;
    }
    creditAvailableCrc += available;
    creditLimitCrc += limit;
  }
  const creditLevel = availabilityLevel(creditAvailableCrc, creditLimitCrc);
  const withLimit = credit.filter((c) => c.limit != null).length;

  const cutoffs = cards
    .map((card) => {
      const multi = multiByCard.get(card.id)!;
      const cur = multi.currencies[0];
      const st = multi.byCurrency[cur]!;
      const cutoff = nextCutoffDate(card.cutoff_day, today);
      return { card: { ...card, currency: cur }, st, cutoff, days: daysUntil(cutoff, today) };
    })
    .sort((a, b) => a.days - b.days);

  const upcoming = payments.filter((p) => !p.overdue);
  const overdueCards = overdue.filter((p) => p.kind === "card").length;
  const overdueLoans = overdue.filter((p) => p.kind === "loan").length;
  const hasLoanDue = loanEntries.some((l) => l.due);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="rise text-2xl font-semibold tracking-tight">Resumen</h1>

      {overdue.length > 0 ? (
        <div className="rise flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 dark:bg-destructive/10">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-destructive">
              {[
                overdueCards > 0
                  ? `${overdueCards} tarjeta${overdueCards === 1 ? "" : "s"}`
                  : null,
                overdueLoans > 0
                  ? `${overdueLoans} préstamo${overdueLoans === 1 ? "" : "s"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" y ")}{" "}
              {overdueLoans === 0
                ? overdueCards === 1
                  ? "atrasada"
                  : "atrasadas"
                : overdue.length === 1
                  ? "atrasado"
                  : "atrasados"}
              {overdueTotal > 0
                ? ` · ${formatCurrency(overdueTotal)} sin pagar`
                : ""}{" "}
              — genera intereses
            </p>
            <p className="text-xs text-muted-foreground">
              {overdue
                .map(
                  (p) =>
                    `${paymentName(p)} (venció ${relativeDayLabel(p.daysToDue)})`,
                )
                .join(" · ")}
            </p>
          </div>
        </div>
      ) : null}

      {/* 2.5.0: grilla del Resumen. Cada card abre su detalle en un modal. */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Fila 1 · Liquidez */}
        <StatDialog
          title="Liquidez"
          description="Cuentas de débito en colones con saldo. No incluye efectivo ni ahorros."
          icon={<Wallet className="size-4" />}
          value={formatCurrency(availableDebit)}
          size="lg"
          hint={`${liquidAccounts.length} cuenta${liquidAccounts.length === 1 ? "" : "s"} de débito · toca para ver el detalle`}
          className="rise lg:col-span-3"
          style={rise(1)}
        >
          {liquidAccounts.length === 0 ? (
            <EmptyDetail>No hay cuentas de débito en colones con saldo.</EmptyDetail>
          ) : (
            <DetailList
              total={formatCurrency(availableDebit)}
              rows={liquidAccounts.map((a) => ({
                key: a.id,
                title: a.name,
                subtitle: a.institution ?? undefined,
                amount: formatCurrency(Number(a.current_balance), a.currency),
                share: availableDebit > 0 ? Number(a.current_balance) / availableDebit : 0,
              }))}
            />
          )}
        </StatDialog>

        {/* Fila 2 · A pagar de contado · Consumo sin cortar · Faltante */}
        <StatDialog
          title={hasLoanDue ? "A pagar (tarjetas y préstamos)" : "A pagar de contado"}
          description="Pagos de contado de las tarjetas y cuotas de préstamos por vencer o atrasados."
          icon={<CalendarClock className="size-4" />}
          value={formatCurrency(totalCrcDue)}
          tone={totalCrcDue > availableDebit && totalCrcDue > 0 ? "negative" : "default"}
          hint={`${payments.length} pago${payments.length === 1 ? "" : "s"} pendiente${payments.length === 1 ? "" : "s"}`}
          className="rise"
          style={rise(2)}
        >
          {payments.length === 0 ? (
            <EmptyDetail>Sin pagos de contado pendientes. Estás al día.</EmptyDetail>
          ) : (
            <div className="flex flex-col gap-4">
              {overdue.length > 0 ? <PaymentGroup title="Atrasadas" payments={overdue} /> : null}
              {upcoming.length > 0 ? <PaymentGroup title="Por vencer" payments={upcoming} /> : null}
              <DetailTotal label="Total en colones" value={formatCurrency(totalCrcDue)} />
            </div>
          )}
        </StatDialog>

        <StatDialog
          title="Consumo sin cortar"
          description="Lo que llevas cargado desde el último corte de cada tarjeta."
          icon={<CreditCard className="size-4" />}
          value={formatCurrency(newChargesCrc)}
          hint={`${unbilled.length} tarjeta${unbilled.length === 1 ? "" : "s"} con consumo`}
          className="rise"
          style={rise(3)}
        >
          {unbilled.length === 0 ? (
            <EmptyDetail>Ninguna tarjeta tiene consumo después del corte.</EmptyDetail>
          ) : (
            <DetailList
              total={formatCurrency(newChargesCrc)}
              totalLabel="Total en colones"
              rows={unbilled.map(({ card, st, cutoff }) => ({
                key: `${card.id}:${card.currency}`,
                href: `/procesos/tarjetas/${card.id}`,
                title: card.name,
                subtitle: `Corta ${formatDate(cutoff)}`,
                amount: formatCurrency(st.newCharges, card.currency),
              }))}
            />
          )}
        </StatDialog>

        <div className="surface rise flex flex-col gap-2 p-4 sm:p-5" style={rise(4)}>
          <StatBody
            title="Faltante"
            icon={<ShieldAlert className="size-4" />}
            value={formatCurrency(shortfall.amount)}
            tone={SHORTFALL_TONE[shortfall.level]}
            hint={
              shortfall.level === "covered"
                ? "Tu liquidez cubre todos los pagos de contado"
                : shortfall.level === "later"
                  ? "Cubres los próximos 10 días, no todos los pagos"
                  : "Te falta para los pagos de los próximos 10 días"
            }
          />
        </div>

        {/* Filas 3 y 4 · Gastos por período y gráfico por categoría */}
        <ExpenseOverview
          points={expensePoints}
          todayISO={todayISO}
          icons={categoryIcons}
          hasUsd={expenseRows.some((t) => t.currency === "USD")}
        />

        {/* Fila 5 · Disponible en crédito · Cobros a miembros · Financiamientos */}
        <StatDialog
          title="Disponible en crédito"
          description="Límite menos lo usado en cada tarjeta, incluido el capital de los financiamientos y el consumo sin cortar."
          icon={<CircleGauge className="size-4" />}
          value={formatCurrency(creditAvailableCrc)}
          tone={creditLevel ? AVAILABILITY_TONE[creditLevel.level] : "default"}
          hint={
            creditLimitCrc > 0
              ? `${Math.round((creditLevel?.ratio ?? 0) * 100)} % de ${formatCurrency(creditLimitCrc)} de límite`
              : "Agrega el límite de tus tarjetas"
          }
          className="rise"
          style={rise(11)}
        >
          {withLimit === 0 ? (
            <EmptyDetail>
              Ninguna tarjeta tiene límite de crédito. Agrégalo al editar la tarjeta.
            </EmptyDetail>
          ) : (
            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-2">
                {credit.map(({ card, limit, limitCurrency, av, level }) => (
                  <li key={card.id}>
                    <Link
                      href={`/procesos/tarjetas/${card.id}`}
                      className={cn("flex flex-col gap-2 rounded-xl bg-muted/50 p-3", PRESSABLE_ROW)}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-medium">{card.name}</span>
                        <span
                          className={cn(
                            "shrink-0 font-semibold tabular-nums",
                            level?.level === "high" && "text-success",
                            level?.level === "medium" && "text-warning",
                            level?.level === "low" && "text-destructive",
                          )}
                        >
                          {av.available != null ? formatCurrency(av.available, limitCurrency) : "—"}
                        </span>
                      </div>
                      {level ? (
                        <Bar value={level.ratio} className={AVAILABILITY_BAR[level.level]} />
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {limit == null
                          ? "Sin límite registrado"
                          : av.missingRate
                            ? "Falta el tipo de cambio para calcularlo"
                            : `${Math.round((level?.ratio ?? 0) * 100)} % disponible de ${formatCurrency(limit, limitCurrency)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <DetailTotal label="Total disponible (en colones)" value={formatCurrency(creditAvailableCrc)} />
              {creditSkipped > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {creditSkipped} tarjeta{creditSkipped === 1 ? "" : "s"} sin tipo de cambio no
                  suma{creditSkipped === 1 ? "" : "n"} al total.
                </p>
              ) : null}
            </div>
          )}
        </StatDialog>

        <Link
          href="/procesos/cobros"
          className={cn("surface rise flex flex-col gap-2 p-4 sm:p-5", PRESSABLE_SURFACE, FOCUS_OUTLINE)}
          style={rise(12)}
        >
          <StatBody
            title="Cobros a miembros"
            icon={<BellRing className="size-4" />}
            value={formatCurrency(receivableCrc)}
            hint={
              noticesToSend > 0
                ? `${noticesToSend} aviso${noticesToSend === 1 ? "" : "s"} por enviar`
                : receivableCrc > 0
                  ? "De cuotas cobradas y gastos compartidos"
                  : "Nadie te debe nada"
            }
            trailing={<LinkChevron />}
          />
        </Link>

        <StatDialog
          title="Financiamientos"
          description="Planes de cuotas con cuotas por cobrar. Toca uno para ver su detalle."
          icon={<Layers className="size-4" />}
          value={`${financings.length} activo${financings.length === 1 ? "" : "s"}`}
          hint={
            financingPending > 0
              ? `${formatCurrency(financingPending)} de capital por cobrar`
              : "Sin capital por cobrar"
          }
          className="rise"
          style={rise(13)}
        >
          {financings.length === 0 ? (
            <EmptyDetail>No tienes financiamientos activos.</EmptyDetail>
          ) : (
            <div className="flex flex-col gap-3">
              <DetailList
                rows={financings.map(({ f, p }) => ({
                  key: f.id,
                  href: `/procesos/tarjetas/${f.card_id}/financiamientos/${f.id}`,
                  title: f.description,
                  subtitle: [cardName.get(f.card_id), `${p.scheduled.length} cuota${p.scheduled.length === 1 ? "" : "s"} por cobrar`]
                    .filter(Boolean)
                    .join(" · "),
                  amount: formatCurrency(p.next!.amount, f.currency),
                  amountHint: formatDate(p.next!.occurred_on),
                }))}
              />
              <Link
                href="/procesos/financiamientos"
                className="self-end text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Ver todos los financiamientos
              </Link>
            </div>
          )}
        </StatDialog>

        {/* P8 (3.0.1): recordatorios, como una card más (no un banner). */}
        <Reminders
          style={rise(14)}
          items={buildReminders({
            todayISO,
            upcoming: plansBoard.upcoming.map((u) => ({
              name: u.plan.name,
              kind: u.plan.kind,
              date: u.date,
              amount: Number(u.plan.amount),
              currency: u.plan.currency,
            })),
            toConfirm: estimated.length,
            noticesToSend,
            minimums: cards.flatMap((card) => {
              const multi = multiByCard.get(card.id);
              if (!multi) return [];
              return multi.currencies.flatMap((cur) => {
                const st = multi.byCurrency[cur]!;
                const m = ((minimumData ?? []) as { card_id: string; cutoff_on: string; currency: string; amount: number }[]).find(
                  (x) => x.card_id === card.id && x.currency === cur && x.cutoff_on === toISODate(st.lastCutoff),
                );
                if (!m) return [];
                const status = minimumPaymentStatus(Number(m.amount), st.paidAfterCutoff);
                return [{ card: card.name, remaining: status.remaining, currency: cur, dueOn: toISODate(st.dueDate) }];
              });
            }),
          })}
        />

        {/* Fila 6 · Línea base y metas (2.7.0) */}
        <PlansAndGoals
          board={plansBoard}
          goals={goals}
          balances={Object.fromEntries(accounts.map((a) => [a.id, Number(a.current_balance)]))}
          todayISO={todayISO}
        />
      </div>

      <p className="-mt-4 text-xs text-muted-foreground">
        Patrimonio neto (cuentas − tarjetas − préstamos, en colones): {formatCurrency(netWorth)}
        {rate ? ` · $1 = ${formatCurrency(rate.usd_crc)} (${formatDate(rate.rate_on)})` : ""}
        {unconverted ? " · sin tipo de cambio, lo de dólares no suma" : ""}
        {loans.length > 0
          ? ` · Capital pendiente en préstamos: ${formatCurrency(loanPrincipalCrc)}`
          : ""}
      </p>

      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Pagos próximos</h2>
          {cards.length === 0 && loans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay tarjetas ni préstamos registrados.{" "}
              <Link href="/procesos/tarjetas" className="underline">
                Agrega una tarjeta
              </Link>
              .
            </p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin pagos de contado ni cuotas pendientes. Estás al día.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {overdue.length > 0 ? (
                <PaymentGroup title="Atrasadas" payments={overdue} />
              ) : null}
              {upcoming.length > 0 ? (
                <PaymentGroup
                  title="Por vencer"
                  payments={upcoming}
                  dividerAt={
                    firstUncovered >= 0
                      ? firstUncovered - overdue.length
                      : undefined
                  }
                />
              ) : null}
            </div>
          )}
        </section>

        {cutoffs.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Próximos cortes</h2>
            <p className="-mt-1 text-sm text-muted-foreground">
              El corte fija el saldo de contado que vas a tener que pagar.
            </p>
            <Panel className="divide-y">
              {cutoffs.map(({ card, st, cutoff, days }) => (
                <CutoffRow
                  key={card.id}
                  card={card}
                  st={st}
                  cutoff={cutoff}
                  days={days}
                />
              ))}
            </Panel>
          </section>
        ) : null}
      </div>
    </div>
  );
}

type DetailRow = {
  key: string;
  title: string;
  subtitle?: string;
  amount: string;
  amountHint?: string;
  href?: string;
  /** Parte del total (0..1): barra fina debajo. */
  share?: number;
};

/** Filas del detalle de un modal del Resumen, con total opcional. */
function DetailList({
  rows,
  total,
  totalLabel = "Total",
}: {
  rows: DetailRow[];
  total?: string;
  totalLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  {r.subtitle ? (
                    <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{r.amount}</p>
                    {r.amountHint ? (
                      <p className="text-xs text-muted-foreground">{r.amountHint}</p>
                    ) : null}
                  </div>
                  {r.href ? <LinkChevron /> : null}
                </div>
              </div>
              {r.share != null ? <Bar value={r.share} className="bg-foreground/70" /> : null}
            </>
          );
          return (
            <li key={r.key}>
              {r.href ? (
                <Link
                  href={r.href}
                  className={cn("flex flex-col gap-2 rounded-xl bg-muted/50 p-3", PRESSABLE_ROW)}
                >
                  {body}
                </Link>
              ) : (
                <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {total ? <DetailTotal label={totalLabel} value={total} /> : null}
    </div>
  );
}

function DetailTotal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t pt-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function EmptyDetail({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function paymentName(p: Payment): string {
  return p.kind === "card" ? p.card.name : p.loan.name;
}

function paymentKey(p: Payment): string {
  return p.kind === "card" ? `card:${p.card.id}:${p.currency}` : `loan:${p.loan.id}`;
}

function paymentSubtitle(p: Payment): string | null {
  if (p.kind === "card") return cardSubtitle(p.card);
  const n = p.due.installments;
  const cuotas = n.length === 1 ? `Cuota ${n[0]}/${p.loan.months}` : `Cuotas ${n[0]}–${n.at(-1)}/${p.loan.months}`;
  return ["Préstamo", cuotas, p.loan.lender].filter(Boolean).join(" · ");
}

function cardSubtitle(card: CreditCardType) {
  return (
    [card.institution, card.last_four && `•••• ${card.last_four}`]
      .filter(Boolean)
      .join(" · ") || null
  );
}

function PaymentGroup({
  title,
  payments,
  dividerAt,
}: {
  title: string;
  payments: Payment[];
  dividerAt?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <Panel className="divide-y">
        {payments.map((p, i) => (
          <div key={paymentKey(p)}>
            {dividerAt === i && i > 0 ? (
              <p className="border-b bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
                Desde aquí los pagos superan tu disponible en débito
              </p>
            ) : null}
            <PaymentRow p={p} />
          </div>
        ))}
      </Panel>
    </div>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  const { amount, currency } = p;
  const days = p.daysToDue;
  const overdue = p.overdue;
  const href =
    p.kind === "card" ? `/procesos/tarjetas/${p.card.id}` : `/procesos/prestamos/${p.loan.id}`;
  const level = levelFor(days, overdue);
  const badgeText = overdue
    ? `venció ${relativeDayLabel(days)}`
    : days === 0
      ? "vence hoy"
      : `vence ${relativeDayLabel(days)}`;
  const proximity = Math.max(0, Math.min(1, 1 - days / 30));
  const subtitle = paymentSubtitle(p);

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-2 border-l-4 px-4 py-3",
        PRESSABLE_ROW,
        LEVEL_BORDER[level],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{paymentName(p)}</p>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="tabular-nums font-medium">
            {formatCurrency(amount, currency)}
            {currency !== "CRC" ? (
              <span className="ml-1 text-xs text-muted-foreground">
                ({currency})
              </span>
            ) : null}
          </span>
          <UrgencyBadge level={level}>{badgeText}</UrgencyBadge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Bar value={proximity} className={LEVEL_BAR[level]} />
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(p.dueDate)}
        </span>
        <LinkChevron className="-mr-1" />
      </div>
    </Link>
  );
}

function CutoffRow({
  card,
  st,
  cutoff,
  days,
}: {
  card: CreditCardType;
  st: CardStatement;
  cutoff: Date;
  days: number;
}) {
  const soon = days <= 1;
  return (
    <Link
      href={`/procesos/tarjetas/${card.id}`}
      className={cn("flex items-center justify-between gap-4 px-4 py-3", PRESSABLE_ROW)}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{card.name}</p>
        <p className="text-xs text-muted-foreground">
          {st.newCharges > 0
            ? `${formatCurrency(st.newCharges, card.currency)} sin cortar`
            : "Sin consumo nuevo"}
        </p>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-sm tabular-nums">{formatDate(cutoff)}</span>
        <span
          className={cn(
            "text-xs",
            soon ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {days === 0 ? "corta hoy" : `corta ${relativeDayLabel(days)}`}
        </span>
      </div>
      <LinkChevron className="-mr-1" />
    </Link>
  );
}

function UrgencyBadge({
  level,
  children,
}: {
  level: Level;
  children: ReactNode;
}) {
  if (level === "overdue" || level === "urgent") {
    return <Badge variant="destructive">{children}</Badge>;
  }
  if (level === "soon") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        {children}
      </Badge>
    );
  }
  return <Badge variant="secondary">{children}</Badge>;
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", className)}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}
