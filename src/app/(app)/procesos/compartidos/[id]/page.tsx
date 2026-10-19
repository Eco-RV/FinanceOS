import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crToday, daysUntil, fromISODate, toISODate } from "@/domain";
import { formatCurrency, formatDate, relativeDayLabel } from "@/lib/format";
import { loadSharedBoard } from "@/lib/shared-board";
import { INCOME_CATEGORIES, REIMBURSEMENT_CHANNEL_LABELS } from "@/lib/schema";
import { categoryNames } from "@/lib/categories";
import { productLabel } from "@/lib/transactions";
import type { Account, CreditCard } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { buttonVariants } from "@/components/ui/button";
import { SharedNoticeCard } from "../shared-notice-card";
import { SharedPaidBadge, SharedPaymentDialog, UnshareButton } from "../shared-actions";

/** Detalle de un gasto compartido (3.0.1): partes, pagos y avisos. */
export default async function SharedExpensePage({ params }: PageProps<"/procesos/compartidos/[id]">) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const todayISO = toISODate(crToday());
  const [board, { data: accData }, { data: cardData }, { data: catData }, { data: conn }, { data: lastIncome }] =
    await Promise.all([
      loadSharedBoard(supabase, todayISO, { id }),
      supabase.from("accounts").select("*").order("created_at", { ascending: true }),
      supabase.from("credit_cards").select("id, name, archived"),
      supabase.from("categories").select("name").eq("kind", "income").eq("archived", false).order("name"),
      supabase.from("mail_connections").select("scopes").eq("provider", "gmail").maybeSingle(),
      // 04: la cuenta en que se cobró la última vez se propone de nuevo.
      supabase
        .from("shared_expense_parts")
        .select("income_transaction_id")
        .not("income_transaction_id", "is", null)
        .order("paid_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  const expense = board.expenses.get(id);
  if (!expense) notFound();

  const accounts = (accData ?? []) as Account[];
  const cards = (cardData ?? []) as Pick<CreditCard, "id" | "name" | "archived">[];
  const origin = expense.card_id
    ? productLabel(cards.find((c) => c.id === expense.card_id))
    : productLabel(accounts.find((a) => a.id === expense.account_id));
  const sameCurrency = accounts
    .filter((a) => !a.archived && a.currency === expense.currency)
    .map((a) => ({ id: a.id, name: a.name }));
  const incomeCategories = categoryNames(catData ?? [], INCOME_CATEGORIES);
  const { data: lastTx } = lastIncome?.income_transaction_id
    ? await supabase.from("transactions").select("account_id").eq("id", lastIncome.income_transaction_id).maybeSingle()
    : { data: null };
  const lastAccountId = (lastTx?.account_id as string | null | undefined) ?? null;
  const canEmail = String(conn?.scopes ?? "").includes("gmail.send");

  const collected = expense.parts.filter((p) => p.paid_on).reduce((s, p) => s + p.amount, 0);
  const owed = expense.parts.reduce((s, p) => s + p.amount, 0);
  const anyPaid = expense.parts.some((p) => p.paid_on);
  const groups = board.groups;
  const money = (n: number) => formatCurrency(n, expense.currency);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/procesos/compartidos" label="Gastos compartidos" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{expense.description}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(expense.occurred_on)} · {origin}
            {expense.category ? ` · ${expense.category}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/procesos/compartidos/${id}/editar`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Pencil className="size-4" /> Editar reparto
          </Link>
          <UnshareButton id={id} disabled={anyPaid} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={money(expense.total_amount)} />
        <Stat label="Tu parte" value={money(expense.own)} />
        <Stat label="Cobrado" value={`${money(collected)} de ${money(owed)}`} />
        <Stat
          label="Fecha límite"
          value={formatDate(expense.due_on)}
          hint={
            collected < owed
              ? `${relativeDayLabel(daysUntil(fromISODate(expense.due_on), crToday()))}${expense.card_id ? " · pago de la tarjeta" : ""}`
              : "todo cobrado"
          }
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Personas</h2>
        <ul className="surface flex flex-col divide-y">
          {expense.parts.map((p) => {
            const member = board.members.get(p.member_id);
            return (
              <li key={p.member_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{member?.name ?? "Persona"}</p>
                  {p.note ? <p className="text-xs text-muted-foreground">{p.note}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{money(p.amount)}</span>
                  {p.paid_on ? (
                    <SharedPaidBadge
                      id={id}
                      memberId={p.member_id}
                      paidOn={p.paid_on}
                      channelLabel={p.channel ? REIMBURSEMENT_CHANNEL_LABELS[p.channel] : ""}
                      withIncome={Boolean(p.income_transaction_id)}
                    />
                  ) : (
                    <SharedPaymentDialog
                      id={id}
                      memberId={p.member_id}
                      memberName={member?.name ?? "Persona"}
                      amount={p.amount}
                      currency={expense.currency}
                      accounts={sameCurrency}
                      incomeCategories={incomeCategories}
                      lastAccountId={lastAccountId}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {groups.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <BellRing className="size-4 text-muted-foreground" /> Avisar
          </h2>
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <SharedNoticeCard
                key={`${g.member_id}:${g.due_on}`}
                group={g}
                board={board}
                canEmail={canEmail}
                muted={!g.needsNotice}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface flex flex-col gap-0.5 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
