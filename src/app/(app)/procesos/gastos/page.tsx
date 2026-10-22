import Link from "next/link";
import { Layers } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { categoryOptions, iconsByName } from "@/lib/categories";
import { loadDebitCards } from "@/lib/debit-cards";
import { crToday, toISODate } from "@/domain";
import type { Account, Category, CreditCard, Transaction } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { buttonVariants } from "@/components/ui/button";
import { TransactionForm } from "../_transactions/transaction-form";
import { AutoOpen } from "@/components/auto-open";
import { EmptyRows } from "@/components/row-list";
import { getEnabledFeatures } from "@/lib/features";
import { loadSharedLinks } from "@/lib/shared-board";
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
  searchParams: Promise<{ desde?: string; hasta?: string; categoria?: string; nuevo?: string }>;
}) {
  const [, params, enabled] = await Promise.all([requireUser(), searchParams, getEnabledFeatures()]);
  const filters = initialFilters(params);
  // 3.2.0: `?nuevo=1` (primeros pasos) abre "Nuevo gasto".
  const openNew = params.nuevo === "1";

  const supabase = await createClient();
  // 3.1.0: qué gastos están compartidos (en paralelo con el resto).
  const linksPromise = loadSharedLinks(supabase);
  const [
    { data: txData },
    { data: accData },
    { data: cardData },
    { data: catData },
    allDebitCards,
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
    loadDebitCards(supabase, { includeArchived: true }),
  ]);
  const debitCards = allDebitCards.filter((d) => !d.archived);

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
            Cargos a tarjeta de crédito o débito, en efectivo y pagos por SINPE.
          </p>
        </div>
        {canRegister ? (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {/* 3.2.0 (E2): función "Financiamientos". */}
            {enabled.has("financiamientos") ? (
              <Link
                href="/procesos/financiamientos"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Layers className="size-4" /> Financiamientos
              </Link>
            ) : null}
            {accounts.length > 0 ? (
              <TransactionForm
                type="expense"
                sinpe
                accounts={accounts}
                cards={cards}
                debitCards={debitCards}
                categories={categories}
                categoryIcons={categoryIcons}
                triggerLabel="Nuevo SINPE"
              />
            ) : null}
            <AutoOpen when={openNew} param="nuevo">
              <TransactionForm
                type="expense"
                accounts={accounts}
                cards={cards}
                debitCards={debitCards}
                categories={categories}
                categoryIcons={categoryIcons}
              />
            </AutoOpen>
          </div>
        ) : null}
      </div>

      {canRegister ? (
        <ExpenseExplorer
          key={`${filters.from}:${filters.to}:${filters.category}`}
          transactions={transactions}
          accounts={allAccounts}
          cards={allCards}
          debitCards={allDebitCards}
          categories={categories}
          categoryIcons={categoryIcons}
          todayISO={toISODate(crToday())}
          initial={filters}
          sharedLinks={await linksPromise}
          shareable={enabled.has("compartidos")}
          emptyAction={
            <TransactionForm
              type="expense"
              accounts={accounts}
              cards={cards}
              debitCards={debitCards}
              categories={categories}
              categoryIcons={categoryIcons}
            />
          }
        />
      ) : (
        <EmptyRows
          action={
            <>
              <Link href="/procesos/tarjetas?nueva=1" className={buttonVariants({ size: "sm" })}>
                Agregar tarjeta
              </Link>
              <Link href="/procesos/cuentas?nueva=1" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Agregar cuenta
              </Link>
            </>
          }
        >
          Para anotar gastos primero agrega la tarjeta o la cuenta con la que pagas.
        </EmptyRows>
      )}
    </div>
  );
}
