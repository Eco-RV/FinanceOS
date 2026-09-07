import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import { TransactionForm } from "../_transactions/transaction-form";
import { TransactionList } from "../_transactions/transaction-list";

export default async function GastosPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data: txData }, { data: accData }, { data: cardData }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("type", "expense")
        .eq("archived", false)
        .order("occurred_on", { ascending: false }),
      supabase
        .from("accounts")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: true }),
      supabase
        .from("credit_cards")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: true }),
    ]);

  const transactions = (txData ?? []) as Transaction[];
  const accounts = (accData ?? []) as Account[];
  const cards = (cardData ?? []) as CreditCard[];
  const canRegister = accounts.length > 0 || cards.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Gastos</h1>
          <p className="text-sm text-muted-foreground">
            Pagos desde una cuenta de débito o cargos a una tarjeta.
          </p>
        </div>
        {canRegister ? (
          <TransactionForm type="expense" accounts={accounts} cards={cards} />
        ) : null}
      </div>

      {canRegister ? (
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          cards={cards}
          emptyLabel="Aún no registrás gastos."
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
