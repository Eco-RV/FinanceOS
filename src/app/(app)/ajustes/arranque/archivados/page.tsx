import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/supabase/all-rows";
import { formatDate } from "@/lib/format";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { ArchivedExplorer } from "./archived-explorer";

/**
 * Lo que archivó el Arranque de 0 (3.1.0, M9): solo se consulta. Restaurarlo
 * duplicaría los saldos frente a los saldos iniciales nuevos.
 */
export default async function ArchivedPage() {
  await requireUser();
  const supabase = await createClient();
  const [transactions, { data: accData }, { data: cardData }, { data: startData }] = await Promise.all([
    allRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .eq("archived", true)
        .order("occurred_on", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    supabase.from("accounts").select("*"),
    supabase.from("credit_cards").select("*"),
    supabase.from("fresh_starts").select("started_on, archived_movements").order("created_at", { ascending: false }),
  ]);
  const starts = (startData ?? []) as { started_on: string; archived_movements: number }[];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ajustes/arranque" label="Arranque de 0" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos archivados</h1>
        <p className="text-sm text-muted-foreground">
          Lo que guardó cada Arranque de 0. Solo se consulta: no cuenta en saldos ni se restaura.
          {starts.length > 0
            ? ` Arranques: ${starts.map((s) => `${formatDate(s.started_on)} (${s.archived_movements})`).join(" · ")}.`
            : ""}
        </p>
      </div>
      <ArchivedExplorer
        transactions={transactions}
        accounts={(accData ?? []) as Account[]}
        cards={(cardData ?? []) as CreditCard[]}
      />
    </div>
  );
}
