import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { repositories } from "@/infrastructure/container";
import { crToday, toISODate } from "@/domain";
import { loadSharedBoard } from "@/lib/shared-board";
import { productLabel } from "@/lib/transactions";
import type { Account, CreditCard, Member } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { SharedExpenseForm } from "../../shared-expense-form";

/** Editar el reparto de un gasto compartido (X2, X3 y X6). */
export default async function EditSharedExpensePage({
  params,
}: PageProps<"/procesos/compartidos/[id]/editar">) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const [board, { data: memberData }, { data: accData }, { data: cardData }] = await Promise.all([
    loadSharedBoard(supabase, toISODate(crToday()), { id }),
    supabase.from("members").select("*").order("name", { ascending: true }),
    supabase.from("accounts").select("id, name, archived"),
    supabase.from("credit_cards").select("id, name, archived"),
  ]);
  const expense = board.expenses.get(id);
  if (!expense) notFound();
  const source = await (await repositories()).sharedExpenses.source(expense.transaction_id);
  if (!source) notFound();

  const card = ((cardData ?? []) as Pick<CreditCard, "id" | "name" | "archived">[]).find((c) => c.id === expense.card_id);
  const account = ((accData ?? []) as Pick<Account, "id" | "name" | "archived">[]).find(
    (a) => a.id === expense.account_id,
  );
  const inExpense = new Set(expense.parts.map((p) => p.member_id));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <BackLink href={`/procesos/compartidos/${id}`} label={expense.description} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar reparto</h1>
        <p className="text-sm text-muted-foreground">
          Las partes de quien ya pagó no se cambian (primero se deshace su pago).
        </p>
      </div>
      <SharedExpenseForm
        source={{
          movement_id: expense.transaction_id,
          amount: expense.total_amount,
          currency: expense.currency,
          occurred_on: expense.occurred_on,
          originLabel: card ? productLabel(card) : productLabel(account),
          category: expense.category,
          note: expense.description,
          card: source.card,
        }}
        existing={{
          id,
          description: expense.description,
          due_on: expense.due_on,
          parts: expense.parts.map((p) => ({ member_id: p.member_id, amount: p.amount, paid: Boolean(p.paid_on) })),
        }}
        people={((memberData ?? []) as Member[])
          .filter((m) => !m.archived || inExpense.has(m.id))
          .map((m) => ({ id: m.id, name: m.name, archived: m.archived }))}
      />
    </div>
  );
}
