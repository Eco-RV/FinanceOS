import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { INCOME_CATEGORIES } from "@/lib/schema";
import { categoryOptions, iconsByName } from "@/lib/categories";
import type { Account, Category, Transaction } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { TransactionForm } from "../_transactions/transaction-form";
import { loadSharedLinks } from "@/lib/shared-board";
import { TransactionList } from "../_transactions/transaction-list";

export default async function IngresosPage() {
  await requireUser();

  const supabase = await createClient();
  const linksPromise = loadSharedLinks(supabase);
  const [{ data: txData }, { data: accData }, { data: catData }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("type", "income")
        .eq("archived", false)
        .order("occurred_on", { ascending: false }),
      supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("categories")
        .select("*")
        .eq("kind", "income")
        .eq("archived", false)
        .order("name", { ascending: true }),
    ]);

  const transactions = (txData ?? []) as Transaction[];
  // Incluye las desactivadas para nombrarlas en el historial (G4: el
  // formulario solo recibe las activas).
  const allAccounts = (accData ?? []) as Account[];
  const accounts = allAccounts.filter((a) => !a.archived);
  const options = categoryOptions((catData ?? []) as Category[], INCOME_CATEGORIES);
  const categories = options.map((o) => o.name);
  const categoryIcons = iconsByName(options);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ingresos</h1>
          <p className="text-sm text-muted-foreground">
            Depósitos y entradas a tus cuentas.
          </p>
        </div>
        {accounts.length > 0 ? (
          <TransactionForm
            type="income"
            accounts={accounts}
            categories={categories}
            categoryIcons={categoryIcons}
          />
        ) : null}
      </div>

      {allAccounts.length > 0 ? (
        <TransactionList
          transactions={transactions}
          accounts={allAccounts}
          cards={[]}
          categories={categories}
          categoryIcons={categoryIcons}
          sharedLinks={await linksPromise}
          emptyLabel="Aún no registrás ingresos."
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Primero agregá una{" "}
          <Link href="/procesos/cuentas" className="underline">
            cuenta
          </Link>
          .
        </p>
      )}
    </div>
  );
}
