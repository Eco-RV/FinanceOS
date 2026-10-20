import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { repositories } from "@/infrastructure/container";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { categoryOptions, iconsByName } from "@/lib/categories";
import { loadDebitCards } from "@/lib/debit-cards";
import { productLabel } from "@/lib/transactions";
import type { Account, Category, CreditCard, Member } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { SharedExpenseForm, type SharedSourceView } from "../shared-expense-form";

const UUID = /^[0-9a-fA-F-]{36}$/;

/**
 * Nuevo gasto compartido (3.1.0). Con `?movimiento=<id>` comparte un gasto ya
 * registrado (acción "Compartir" de las listas) y empieza en el paso 2.
 */
export default async function NewSharedExpensePage({
  searchParams,
}: PageProps<"/procesos/compartidos/nuevo">) {
  await requireUser();
  const params = await searchParams;
  const movementId = typeof params.movimiento === "string" && UUID.test(params.movimiento) ? params.movimiento : null;

  const supabase = await createClient();
  const repos = await repositories();
  const [{ data: accData }, { data: cardData }, { data: catData }, { data: memberData }, debitCards] =
    await Promise.all([
      supabase.from("accounts").select("*").order("created_at", { ascending: true }),
      supabase.from("credit_cards").select("*").order("created_at", { ascending: true }),
      supabase
        .from("categories")
        .select("*")
        .eq("kind", "expense")
        .eq("archived", false)
        .order("name", { ascending: true }),
      supabase.from("members").select("*").eq("archived", false).order("name", { ascending: true }),
      loadDebitCards(supabase),
    ]);
  const allAccounts = (accData ?? []) as Account[];
  const allCards = (cardData ?? []) as CreditCard[];
  const options = categoryOptions((catData ?? []) as Category[], EXPENSE_CATEGORIES);

  let source: SharedSourceView | undefined;
  if (movementId) {
    const link = await repos.sharedExpenses.linkOf(movementId);
    if (link?.role === "expense") redirect(`/procesos/compartidos/${link.shared_expense_id}`);
    const s = await repos.sharedExpenses.source(movementId);
    if (!s || s.type !== "expense") notFound();
    const { data: tx } = await supabase.from("transactions").select("category").eq("id", movementId).maybeSingle();
    const account = allAccounts.find((a) => a.id === s.account_id);
    const card = allCards.find((c) => c.id === s.card?.id);
    source = {
      movement_id: s.movement_id,
      amount: s.amount,
      currency: s.currency,
      occurred_on: s.occurred_on,
      originLabel: card ? productLabel(card) : account ? productLabel(account) : "—",
      category: (tx?.category as string | null) ?? null,
      note: s.note,
      card: s.card,
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <BackLink href="/procesos/compartidos" label="Gastos compartidos" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {source ? "Compartir un gasto" : "Nuevo gasto compartido"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Tú pagas el total; cada persona te debe su parte. Te sugerimos partes iguales y puedes
          ajustar el monto de cada uno.
        </p>
      </div>
      <SharedExpenseForm
        source={source}
        people={((memberData ?? []) as Member[]).map((m) => ({ id: m.id, name: m.name }))}
        accounts={allAccounts.filter((a) => !a.archived)}
        cards={allCards.filter((c) => !c.archived)}
        debitCards={debitCards}
        categories={options.map((o) => o.name)}
        categoryIcons={iconsByName(options)}
      />
    </div>
  );
}
