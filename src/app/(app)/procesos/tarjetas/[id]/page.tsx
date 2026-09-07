import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatCurrency,
  formatDate,
  daysUntil,
  relativeDayLabel,
} from "@/lib/format";
import { nextCutoffDate, nextPaymentDate } from "@/lib/cards";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardFormDialog } from "../card-form";
import { TransactionForm } from "../../_transactions/transaction-form";
import { TransactionList } from "../../_transactions/transaction-list";

export default async function CardDetailPage({
  params,
}: PageProps<"/procesos/tarjetas/[id]">) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: cardData }, { data: txData }, { data: accData }] =
    await Promise.all([
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
    ]);

  if (!cardData) notFound();

  const card = cardData as CreditCard;
  const transactions = (txData ?? []) as Transaction[];
  const accounts = (accData ?? []) as Account[];

  const balance = Number(card.current_balance);
  const limit = card.credit_limit != null ? Number(card.credit_limit) : null;
  const cutoff = nextCutoffDate(card.cutoff_day);
  const payment = nextPaymentDate(card.cutoff_day, card.payment_due_day);
  const paymentIn = daysUntil(payment);

  const subtitle =
    [card.institution, card.last_four && `•••• ${card.last_four}`]
      .filter(Boolean)
      .join(" · ") || null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/procesos/tarjetas"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Tarjetas
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{card.name}</h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <CardFormDialog card={card} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="Saldo actual" value={formatCurrency(balance, card.currency)} />
        <Stat
          title="Límite"
          value={limit != null ? formatCurrency(limit, card.currency) : "—"}
        />
        <Stat
          title="Disponible"
          value={
            limit != null
              ? formatCurrency(limit - balance, card.currency)
              : "—"
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
          <h2 className="text-lg font-medium">Movimientos</h2>
          {accounts.length > 0 ? (
            <TransactionForm
              type="card_payment"
              accounts={accounts}
              fixedCardId={card.id}
              fixedCardBalance={balance}
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
          context="card"
          emptyLabel="Sin movimientos registrados en esta tarjeta."
        />
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  hint,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
