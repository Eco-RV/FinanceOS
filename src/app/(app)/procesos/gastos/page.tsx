import Link from "next/link";
import { Layers } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { categoryOptions, iconsByName } from "@/lib/categories";
import { crToday, toISODate } from "@/domain";
import type { Account, Category, CreditCard, Transaction } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { buttonVariants } from "@/components/ui/button";
import { TransactionForm } from "../_transactions/transaction-form";
import { ExpenseExplorer } from "./expense-explorer";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros que llegan por la URL (p. ej. desde el gráfico del Resumen). */
function initialFilters(params: { desde?: string; hasta?: string; categoria?: string }) {
  return {
    from: params.desde && ISO_DATE.test(params.desde) ? params.desde : "",
    to: params.hasta && ISO_DATE.test(params.hasta) ? params.hasta : "",
    category: params.categoria?.slice(0, 40) ?? "",
  };
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; categoria?: string }>;
}) {
  await requireUser();
  const filters = initialFilters(await searchParams);

  const supabase = await createClient();
  const [
    { data: txData },
    { data: accData },
    { data: cardData },
    { data: catData },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("type", "expense")
      .eq("archived", false)
      .order("occurred_on", { ascending: false }),
    // Incluye las desactivadas para nombrarlas en el historial; los
    // formularios solo reciben las activas (G4).
    supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("credit_cards")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .eq("kind", "expense")
      .eq("archived", false)
      .order("name", { ascending: true }),
  ]);

  const transactions = (txData ?? []) as Transaction[];
  const allAccounts = (accData ?? []) as Account[];
  const allCards = (cardData ?? []) as CreditCard[];
  const accounts = allAccounts.filter((a) => !a.archived);
  const cards = allCards.filter((c) => !c.archived);
  const options = categoryOptions((catData ?? []) as Category[], EXPENSE_CATEGORIES);
  const categories = options.map((o) => o.name);
  const categoryIcons = iconsByName(options);
  const canRegister = accounts.length > 0 || cards.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gastos</h1>
          <p className="text-sm text-muted-foreground">
            Cargos a tarjeta, en efectivo y pagos por SINPE.
          </p>
        </div>
        {canRegister ? (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Link
              href="/procesos/financiamientos"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Layers className="size-4" /> Financiamientos
            </Link>
            {accounts.length > 0 ? (
              <TransactionForm
                type="expense"
                sinpe
                accounts={accounts}
                categories={categories}
                categoryIcons={categoryIcons}
                triggerLabel="Nuevo SINPE"
              />
            ) : null}
            <TransactionForm
              type="expense"
              accounts={accounts}
              cards={cards}
              categories={categories}
              categoryIcons={categoryIcons}
            />
          </div>
        ) : null}
      </div>

      {canRegister ? (
        <ExpenseExplorer
          key={`${filters.from}:${filters.to}:${filters.category}`}
          transactions={transactions}
          accounts={allAccounts}
          cards={allCards}
          categories={categories}
          categoryIcons={categoryIcons}
          todayISO={toISODate(crToday())}
          initial={filters}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Primero agregá una{" "}
          <Link href="/procesos/cuentas" className="underline">
            cuenta
          </Link>{" "}
          o una{" "}
          <Link href="/procesos/tarjetas" className="underline">
            tarjeta
          </Link>
          .
        </p>
      )}
    </div>
  );
}
