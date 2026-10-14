import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Account, Transaction } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { TransferForm } from "../_transactions/transfer-form";
import { TransactionList } from "../_transactions/transaction-list";

/** Transferencias entre cuentas propias (M2): no son gasto ni ingreso. */
export default async function TransferenciasPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data: txData }, { data: accData }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("type", "transfer")
      .eq("archived", false)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  const transactions = (txData ?? []) as Transaction[];
  // Incluye las desactivadas para nombrarlas en el historial (G4: el
  // formulario solo recibe las activas).
  const allAccounts = (accData ?? []) as Account[];
  const accounts = allAccounts.filter((a) => !a.archived);
  const canRegister = accounts.length >= 2;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transferencias</h1>
          <p className="text-sm text-muted-foreground">
            Dinero que movés entre tus propias cuentas. No cuenta como gasto.
          </p>
        </div>
        {canRegister ? <TransferForm accounts={accounts} /> : null}
      </div>

      {canRegister ? (
        <TransactionList
          transactions={transactions}
          accounts={allAccounts}
          cards={[]}
          emptyLabel="Aún no registrás transferencias."
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Necesitás al menos dos{" "}
          <Link href="/procesos/cuentas" className="underline">
            cuentas
          </Link>{" "}
          para transferir entre ellas.
        </p>
      )}
    </div>
  );
}
