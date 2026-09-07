import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { INCOME_CATEGORIES } from "@/lib/schema";
import { categoryNames } from "@/lib/categories";
import type { Account, Transaction } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { TransactionForm } from "../_transactions/transaction-form";
import { TransactionList } from "../_transactions/transaction-list";

export default async function IngresosPage() {
  await requireUser();

  const supabase = await createClient();
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
        .eq("archived", false)
        .order("created_at", { ascending: true }),
      supabase
        .from("categories")
        .select("name")
        .eq("kind", "income")
        .eq("archived", false)
        .order("name", { ascending: true }),
    ]);

  const transactions = (txData ?? []) as Transaction[];
  const accounts = (accData ?? []) as Account[];
  const categories = categoryNames(catData ?? [], INCOME_CATEGORIES);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Ingresos</h1>
          <p className="text-sm text-muted-foreground">
            Depósitos y entradas a tus cuentas.
          </p>
        </div>
        {accounts.length > 0 ? (
          <TransactionForm
            type="income"
            accounts={accounts}
            categories={categories}
          />
        ) : null}
      </div>

      {accounts.length > 0 ? (
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          cards={[]}
          categories={categories}
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
