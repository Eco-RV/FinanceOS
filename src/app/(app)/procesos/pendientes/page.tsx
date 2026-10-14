import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { categoryNames } from "@/lib/categories";
import { formatCurrency, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import type { Bank, CreditCard, PendingTransaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/form-field";
import { BackLink } from "@/components/back-link";
import { approvePending, rejectPending } from "./actions";
import { SyncButton } from "./sync-button";

export default async function PendientesPage() {
  await requireUser();

  const supabase = await createClient();
  const [
    { data: pendingData },
    { data: cardData },
    { data: catData },
    { data: bankData },
    { data: connData },
  ] = await Promise.all([
    supabase
      .from("pending_transactions")
      .select("*")
      .eq("status", "pending")
      .eq("archived", false)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("credit_cards")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("categories")
      .select("name")
      .eq("kind", "expense")
      .eq("archived", false)
      .order("name", { ascending: true }),
    supabase.from("banks").select("id, name"),
    supabase.from("mail_connections").select("email, last_synced_at").maybeSingle(),
  ]);

  const pending = (pendingData ?? []) as PendingTransaction[];
  const cards = (cardData ?? []) as CreditCard[];
  const banks = (bankData ?? []) as Pick<Bank, "id" | "name">[];
  const categories = categoryNames(catData ?? [], EXPENSE_CATEGORIES);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Compras por confirmar</h1>
          <p className="text-sm text-muted-foreground">
            Detectadas en los avisos de tu banco. Confirmá la tarjeta y la
            categoría para registrarlas como gasto.
          </p>
        </div>
        {connData ? <SyncButton /> : null}
      </div>

      {!connData ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no conectaste tu correo.{" "}
          <Link href="/ajustes/bancos" className="underline">
            Conectalo en Ajustes → Bancos
          </Link>
          .
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No hay compras por confirmar.
          {connData.last_synced_at
            ? ` Última lectura: ${formatDate(connData.last_synced_at.slice(0, 10))}.`
            : ""}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((p) => {
            // T1: toda tarjeta acepta CRC y USD; la compra va al saldo de su moneda.
            const options = cards;
            const bank = banks.find((b) => b.id === p.bank_id);
            const cats =
              p.suggested_category && !categories.includes(p.suggested_category)
                ? [p.suggested_category, ...categories]
                : categories;

            return (
              <li key={p.id} className="surface p-3">
                <form className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={p.id} />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.merchant}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(p.occurred_on)}
                        {bank ? ` · ${bank.name}` : ""}
                        {p.last_four ? ` · •••• ${p.last_four}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 font-semibold">
                      {formatCurrency(Number(p.amount), p.currency)}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                      name="card_id"
                      aria-label="Tarjeta"
                      defaultValue={p.card_id ?? ""}
                      required
                    >
                      <option value="" disabled>
                        Elegí la tarjeta
                      </option>
                      {options.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.last_four ? ` •••• ${c.last_four}` : ""}
                        </option>
                      ))}
                    </Select>
                    <Select
                      name="category"
                      aria-label="Categoría"
                      defaultValue={p.suggested_category ?? ""}
                      required
                    >
                      <option value="" disabled>
                        Elegí la categoría
                      </option>
                      {cats.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {options.length === 0 ? (
                    <p className="text-xs text-destructive">
                      No tenés ninguna tarjeta para registrar esta compra.
                    </p>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      formAction={rejectPending}
                      formNoValidate
                    >
                      Descartar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      formAction={approvePending}
                      disabled={options.length === 0}
                    >
                      Aprobar
                    </Button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
