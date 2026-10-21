import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatCurrency,
  formatDate,
  relativeDayLabel,
} from "@/lib/format";
import {
  cardAvailability,
  cardStatementsByCurrency,
  crToday,
  daysUntil,
  isCurrency,
  nextCutoffDate,
  minimumPaymentStatus,
  nextPaymentDate,
  toISODate,
  type Currency,
} from "@/domain";
import { CardBalances, urgentDaysToDue } from "../card-money";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { categoryNames } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type {
  Account,
  Bank,
  CreditCard,
  Financing,
  Transaction,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { WalletCardHero } from "@/components/wallet-card";
import { CardFormDialog } from "../card-form";
import { cardOpeningsById } from "@/lib/transactions";
import { interestByCard, withoutScheduledInterest } from "@/lib/card-balances";
import { CardStatusBadge } from "../card-status";
import { TransactionForm } from "../../_transactions/transaction-form";
import { AutoOpen } from "@/components/auto-open";
import { getEnabledFeatures } from "@/lib/features";
import { MovementExplorer } from "../../_transactions/movement-explorer";
import { allRows } from "@/lib/supabase/all-rows";
import { MinimumPaymentDialog } from "./minimum-payment-form";
import { loadSharedLinks } from "@/lib/shared-board";
import { FinancingForm } from "../_financiamientos/financing-form";
import { FinancingList } from "../_financiamientos/financing-list";

export default async function CardDetailPage({
  params,
  searchParams,
}: PageProps<"/procesos/tarjetas/[id]">) {
  const [, { id }, query, enabled] = await Promise.all([requireUser(), params, searchParams, getEnabledFeatures()]);
  // 3.2.0: `?pago=1` (primeros pasos) abre "Registrar pago / abono".
  const openPayment = query.pago === "1";

  const supabase = await createClient();
  const [
    { data: cardData },
    { data: txData },
    { data: accData },
    { data: catData },
    { data: financingData },
    { data: bankData },
    { data: rateData },
    { data: minimumData },
  ] = await Promise.all([
    supabase
      .from("credit_cards")
      .select("*")
      .eq("id", id)
      .eq("archived", false)
      .maybeSingle(),
    // 3.1.0: todas las filas (PostgREST corta en ~1000), en orden estable.
    allRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .eq("card_id", id)
        .eq("archived", false)
        .order("occurred_on", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ).then((data) => ({ data })),
    supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("categories")
      .select("name")
      .eq("kind", "expense")
      .eq("archived", false)
      .order("name", { ascending: true }),
    supabase
      .from("financings")
      .select("*")
      .eq("card_id", id)
      .eq("archived", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("banks")
      .select("id, name, archived")
      .order("name", { ascending: true }),
    supabase
      .from("exchange_rates")
      .select("rate_on, usd_crc")
      .eq("archived", false)
      .order("rate_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // T8 (3.1.0): pagos mínimos digitados (sin el SQL 3.1.0, vacío).
    supabase.from("card_minimum_payments").select("cutoff_on, currency, amount").eq("card_id", id),
  ]);

  if (!cardData) notFound();

  const transactions = (txData ?? []) as Transaction[];
  const today = crToday();
  // T8: el mínimo digitado para el corte vigente de cada moneda.
  const minimums = (minimumData ?? []) as { cutoff_on: string; currency: string; amount: number }[];
  const minimumFor = (cur: string, s: { lastCutoff: Date }): number | null => {
    const m = minimums.find((x) => x.currency === cur && x.cutoff_on === toISODate(s.lastCutoff));
    return m ? Number(m.amount) : null;
  };
  // F5: el saldo guardado trae el plan completo; solo el capital cuenta desde el día 1.
  const futureInterest = interestByCard(transactions, toISODate(today)).get(cardData.id) ?? {};
  const card = withoutScheduledInterest(
    cardData as CreditCard,
    new Map([[cardData.id as string, futureInterest]]),
  );
  // Incluye las desactivadas para nombrar el origen de abonos viejos; el
  // formulario de abono solo recibe las activas (G4).
  const allAccounts = (accData ?? []) as Account[];
  const accounts = allAccounts.filter((a) => !a.archived);
  const categories = categoryNames(catData ?? [], EXPENSE_CATEGORIES);
  const financings = (financingData ?? []) as Financing[];

  const limit = card.credit_limit != null ? Number(card.credit_limit) : null;
  const limitCurrency: Currency = isCurrency(card.currency) ? card.currency : "CRC";
  const cutoff = nextCutoffDate(card.cutoff_day, today);
  const payment = nextPaymentDate(card.cutoff_day, card.payment_due_day, today);
  const paymentIn = daysUntil(payment, today);

  // T1: un estado de cuenta por moneda; el estado de la tarjeta es el más grave.
  const multi = cardStatementsByCurrency(
    { ...card, currency: limitCurrency },
    transactions.map((t) => ({ ...t, currency: isCurrency(t.currency) ? t.currency : "CRC" })),
    today,
  );
  const st = multi.byCurrency[limitCurrency]!;
  const rate = rateData
    ? { rate_on: rateData.rate_on as string, usd_crc: Number(rateData.usd_crc) }
    : null;
  const balances = {
    CRC: Number(card.current_balance),
    USD: Number(card.usd_balance ?? 0),
  };
  // T2: disponible = límite − saldos convertidos a la moneda del límite.
  const availability = cardAvailability({ creditLimit: limit, limitCurrency, balances, rate });

  const subtitle =
    [card.institution, card.last_four && `•••• ${card.last_four}`]
      .filter(Boolean)
      .join(" · ") || null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/procesos/tarjetas" label="Tarjetas" />
        {/* 2.5.0: la tarjeta animada arriba del todo, como en la billetera. */}
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end sm:gap-6">
          <WalletCardHero card={card} />
        <div className="flex w-full flex-1 items-start justify-between gap-4">
          <div className="rise flex flex-col gap-1" style={{ ["--rise-i" as string]: 4 }}>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
              <CardStatusBadge status={multi.status} daysToDue={urgentDaysToDue(multi)} />
            </div>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <CardFormDialog
            card={card}
            openings={cardOpeningsById(
              transactions
                .filter((t) => t.type === "opening_balance")
                .map((t) => ({ ...t, account_id: null })),
            ).get(card.id)}
            banks={(bankData ?? []) as Pick<Bank, "id" | "name" | "archived">[]}
          />
        </div>
        </div>
      </div>

      {/* Estado de cuenta del corte vigente, una sección por moneda (T1) */}
      {multi.currencies.map((cur) => {
        const s = multi.byCurrency[cur]!;
        const overdue = s.status === "atrasada";
        const settled = s.status === "al-dia" || s.status === "sin-saldo";
        return (
          <section key={cur} className="flex flex-col gap-3">
            {/* 3.1.0 · ceguera a banners: el estado va pegado al título, no en una caja aparte. */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Estado de cuenta{multi.currencies.length > 1 ? ` en ${cur === "CRC" ? "colones" : "dólares"}` : ""}
              </h2>
              {overdue ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-destructive" role="status">
                  <TriangleAlert className="size-4 shrink-0" />
                  Atrasada {Math.abs(s.daysToDue)} día{Math.abs(s.daysToDue) === 1 ? "" : "s"}: venció el{" "}
                  {formatDate(s.dueDate)} y genera intereses
                </p>
              ) : settled ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                  {s.status === "sin-saldo" ? "No hubo saldo en el último corte" : "Estás al día con el corte"}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
              <Stat
                title="Saldo al corte"
                value={formatCurrency(s.statementBalance, cur)}
                hint={`corte del ${formatDate(s.lastCutoff)}`}
              />
              <Stat title="Pagos desde el corte" value={formatCurrency(s.paidAfterCutoff, cur)} />
              <Stat
                title="Falta pagar"
                value={formatCurrency(s.dueAmount, cur)}
                hint={`antes del ${formatDate(s.dueDate)}`}
                emphasis={overdue ? "danger" : s.dueAmount > 0 ? "warn" : undefined}
              />
              <Stat
                title="Pago mínimo"
                value={minimumFor(cur, s) != null ? formatCurrency(minimumFor(cur, s)!, cur) : "—"}
                hint={
                  minimumFor(cur, s) != null
                    ? (() => {
                        const m = minimumPaymentStatus(minimumFor(cur, s)!, s.paidAfterCutoff);
                        return m.covered
                          ? "cubierto con lo que abonaste"
                          : `falta ${formatCurrency(m.remaining, cur)} antes del ${formatDate(s.dueDate)}`;
                      })()
                    : s.statementBalance > 0
                      ? "cópialo de tu estado de cuenta"
                      : undefined
                }
                emphasis={
                  minimumFor(cur, s) != null && !minimumPaymentStatus(minimumFor(cur, s)!, s.paidAfterCutoff).covered
                    ? overdue
                      ? "danger"
                      : "warn"
                    : undefined
                }
                action={
                  s.statementBalance > 0 ? (
                    <MinimumPaymentDialog
                      cardId={card.id}
                      cutoffOn={toISODate(s.lastCutoff)}
                      currency={cur}
                      statementBalance={s.statementBalance}
                      current={minimumFor(cur, s)}
                    />
                  ) : null
                }
              />
              <Stat
                title="Consumo sin cortar"
                value={formatCurrency(s.newCharges, cur)}
                hint={
                  s.prepaid > 0
                    ? `ya descuenta ${formatCurrency(s.prepaid, cur)} de abono anticipado`
                    : `entra al corte del ${formatDate(cutoff)}`
                }
              />
            </div>
          </section>
        );
      })}

      {/* Datos del plástico */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          title="Saldo actual"
          value={<CardBalances card={card} />}
          hint={
            Object.values(futureInterest).some((v) => v > 0)
              ? `+ ${Object.entries(futureInterest)
                  .map(([cur, v]) => formatCurrency(v, cur))
                  .join(" y ")} de interés en cuotas futuras`
              : undefined
          }
        />
        <Stat
          title="Límite"
          value={limit != null ? formatCurrency(limit, limitCurrency) : "—"}
        />
        <Stat
          title="Disponible"
          value={
            availability.available != null
              ? formatCurrency(availability.available, limitCurrency)
              : "—"
          }
          hint={
            availability.missingRate
              ? "Falta el tipo de cambio (Ajustes → Tipo de cambio)"
              : rate && balances.USD !== 0
                ? `con $1 = ${formatCurrency(rate.usd_crc, "CRC")} (${formatDate(rate.rate_on)})`
                : undefined
          }
        />
        <Stat
          title="Próximo corte"
          value={formatDate(cutoff)}
          hint={
            card.cutoff_day_rolls_over
              ? `día ${card.cutoff_day} · ese día pasa al siguiente corte`
              : `día ${card.cutoff_day}`
          }
        />
        <Stat
          title="Pago límite"
          value={formatDate(payment)}
          hint={`día ${card.payment_due_day} · ${relativeDayLabel(paymentIn)}`}
        />
      </div>

      {/* 3.2.0 (E2): con la función apagada solo se ven los financiamientos que ya hay. */}
      {enabled.has("financiamientos") || financings.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">Financiamientos</h2>
            {enabled.has("financiamientos") ? (
              <FinancingForm
                cardId={card.id}
                currency={card.currency}
                categories={categories}
              />
            ) : null}
          </div>
          {financings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin financiamientos activos en esta tarjeta.
            </p>
          ) : (
            <FinancingList
              financings={financings}
              transactions={transactions}
              today={today}
              categories={categories}
            />
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Movimientos</h2>
          {accounts.length > 0 ? (
            <AutoOpen when={openPayment} param="pago">
              <TransactionForm
                type="card_payment"
                accounts={accounts}
                fixedCardId={card.id}
                fixedCardBalance={st.dueAmount > 0 ? st.dueAmount : balances[limitCurrency]}
                fixedCardBalances={{
                  CRC: (multi.byCurrency.CRC?.dueAmount ?? 0) > 0 ? multi.byCurrency.CRC!.dueAmount : balances.CRC,
                  USD: (multi.byCurrency.USD?.dueAmount ?? 0) > 0 ? multi.byCurrency.USD!.dueAmount : balances.USD,
                }}
                cardDebts={balances}
                exchangeRate={rate}
                triggerLabel="Registrar pago / abono"
              />
            </AutoOpen>
          ) : null}
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Para registrar el pago, agrega la{" "}
            <Link href="/procesos/cuentas?nueva=1" className="font-medium text-foreground underline underline-offset-2">
              cuenta con la que pagas
            </Link>
            .
          </p>
        ) : null}
        <MovementExplorer
          context="card"
          transactions={transactions}
          accounts={allAccounts}
          cards={[card]}
          categories={categories}
          todayISO={toISODate(today)}
          emptyLabel="Sin movimientos en esta tarjeta hasta hoy. Anota cada compra con el botón rojo de la flecha hacia arriba: así sabrás cuánto pagar al corte."
          cancelledFinancingIds={financings.filter((f) => f.cancelled_on).map((f) => f.id)}
          sharedLinks={await loadSharedLinks(supabase)}
          shareable={enabled.has("compartidos")}
        />
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  hint,
  emphasis,
  action,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  emphasis?: "danger" | "warn";
  /** Botón pequeño al pie (p. ej. digitar el pago mínimo, T8). */
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-xl font-semibold tabular-nums",
            emphasis === "danger" && "text-destructive",
            emphasis === "warn" && "text-amber-600 dark:text-amber-400",
          )}
        >
          {value}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        {action ? <div className="-ml-2 pt-1">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
