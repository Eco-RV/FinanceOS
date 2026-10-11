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
  nextPaymentDate,
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
import { CardFormDialog } from "../card-form";
import { cardOpeningsById } from "@/lib/transactions";
import { CardStatusBadge } from "../card-status";
import { TransactionForm } from "../../_transactions/transaction-form";
import { TransactionList } from "../../_transactions/transaction-list";
import { FinancingForm } from "../_financiamientos/financing-form";
import { FinancingList } from "../_financiamientos/financing-list";

export default async function CardDetailPage({
  params,
}: PageProps<"/procesos/tarjetas/[id]">) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const [
    { data: cardData },
    { data: txData },
    { data: accData },
    { data: catData },
    { data: financingData },
    { data: bankData },
    { data: rateData },
  ] = await Promise.all([
    supabase
      .from("credit_cards")
      .select("*")
      .eq("id", id)
      .eq("archived", false)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("*")
      .eq("card_id", id)
      .eq("archived", false)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("archived", false)
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
      .select("id, name")
      .eq("archived", false)
      .order("name", { ascending: true }),
    supabase
      .from("exchange_rates")
      .select("rate_on, usd_crc")
      .eq("archived", false)
      .order("rate_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!cardData) notFound();

  const card = cardData as CreditCard;
  const transactions = (txData ?? []) as Transaction[];
  const accounts = (accData ?? []) as Account[];
  const categories = categoryNames(catData ?? [], EXPENSE_CATEGORIES);
  const financings = (financingData ?? []) as Financing[];
  const today = crToday();

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
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{card.name}</h1>
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
            banks={(bankData ?? []) as Pick<Bank, "id" | "name">[]}
          />
        </div>
      </div>

      {/* Estado de cuenta del corte vigente, una sección por moneda (T1) */}
      {multi.currencies.map((cur) => {
        const s = multi.byCurrency[cur]!;
        const overdue = s.status === "atrasada";
        const settled = s.status === "al-dia" || s.status === "sin-saldo";
        return (
          <section key={cur} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">
              Estado de cuenta{multi.currencies.length > 1 ? ` en ${cur === "CRC" ? "colones" : "dólares"}` : ""}
            </h2>

            {overdue ? (
              <Alert tone="danger">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
                <p className="text-sm font-medium">
                  Atrasada {Math.abs(s.daysToDue)} día
                  {Math.abs(s.daysToDue) === 1 ? "" : "s"} — el pago venció el{" "}
                  {formatDate(s.dueDate)} y genera intereses. Falta pagar{" "}
                  {formatCurrency(s.dueAmount, cur)}.
                </p>
              </Alert>
            ) : settled ? (
              <Alert tone="ok">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-foreground/70" />
                <p className="text-sm font-medium">
                  {s.status === "sin-saldo"
                    ? "No hubo saldo en el último corte."
                    : "Estás al día con el corte."}
                </p>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
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
                title="Consumo sin cortar"
                value={formatCurrency(s.newCharges, cur)}
                hint={`entra al corte del ${formatDate(cutoff)}`}
              />
            </div>
          </section>
        );
      })}

      {/* Datos del plástico */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="Saldo actual" value={<CardBalances card={card} />} />
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
          hint={`día ${card.cutoff_day}`}
        />
        <Stat
          title="Pago límite"
          value={formatDate(payment)}
          hint={`día ${card.payment_due_day} · ${relativeDayLabel(paymentIn)}`}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Financiamientos</h2>
          <FinancingForm
            cardId={card.id}
            currency={card.currency}
            categories={categories}
          />
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
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Movimientos</h2>
          {accounts.length > 0 ? (
            <TransactionForm
              type="card_payment"
              accounts={accounts}
              fixedCardId={card.id}
              fixedCardBalance={st.dueAmount > 0 ? st.dueAmount : balances[limitCurrency]}
              triggerLabel="Registrar pago / abono"
            />
          ) : null}
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Agregá una cuenta de débito para registrar pagos.
          </p>
        ) : null}
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          cards={[card]}
          categories={categories}
          context="card"
          emptyLabel="Sin movimientos registrados en esta tarjeta."
          cancelledFinancingIds={financings.filter((f) => f.cancelled_on).map((f) => f.id)}
        />
      </div>
    </div>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "danger" | "ok";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        tone === "danger"
          ? "border-destructive/40 bg-destructive/5"
          : "border-border",
      )}
    >
      {children}
    </div>
  );
}

function Stat({
  title,
  value,
  hint,
  emphasis,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  emphasis?: "danger" | "warn";
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
      </CardContent>
    </Card>
  );
}
