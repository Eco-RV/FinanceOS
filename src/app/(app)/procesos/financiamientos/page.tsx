import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { categoryNames } from "@/lib/categories";
import { crToday, financingProgress, storedInstallments, toISODate } from "@/domain";
import type { CreditCard, Financing, Transaction } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { EmptyRows } from "@/components/row-list";
import { FinancingList } from "../tarjetas/_financiamientos/financing-list";

/**
 * Financiamientos de todas las tarjetas (2.5.0). Muestra los activos (con
 * cuotas por cobrar); los completados y cancelados siguen en cada tarjeta.
 */
export default async function FinanciamientosPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data: finData }, { data: txData }, { data: cardData }, { data: catData }] =
    await Promise.all([
      supabase
        .from("financings")
        .select("*")
        .eq("archived", false)
        .is("cancelled_on", null)
        .order("first_charge_on", { ascending: true }),
      supabase
        .from("transactions")
        .select("*")
        .eq("archived", false)
        .not("financing_id", "is", null),
      supabase.from("credit_cards").select("id, name"),
      supabase
        .from("categories")
        .select("name")
        .eq("kind", "expense")
        .eq("archived", false)
        .order("name", { ascending: true }),
    ]);

  const today = crToday();
  const todayISO = toISODate(today);
  const transactions = (txData ?? []) as Transaction[];
  const cardNames = Object.fromEntries(
    ((cardData ?? []) as Pick<CreditCard, "id" | "name">[]).map((c) => [c.id, c.name]),
  );

  const withProgress = ((finData ?? []) as Financing[]).map((f) => {
    const cuotas = transactions
      .filter((t) => t.financing_id === f.id && t.installment_no != null)
      .map((t) => ({ ...t, installment_no: Number(t.installment_no) }));
    const p = financingProgress(
      storedInstallments(cuotas, f.months, Number(f.total_amount)),
      todayISO,
    );
    return { f, p };
  });
  const active = withProgress.filter(({ p }) => p.next);
  const monthlyCrc = active
    .filter(({ f }) => f.currency !== "USD")
    .reduce((s, { p }) => s + (p.next?.amount ?? 0), 0);
  const pendingCrc = active
    .filter(({ f }) => f.currency !== "USD")
    .reduce((s, { p }) => s + p.scheduled.reduce((x, c) => x + c.amount, 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos/gastos" label="Gastos" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financiamientos</h1>
        <p className="text-sm text-muted-foreground">
          Planes de cuotas activos en todas tus tarjetas. Toca uno para ver su detalle.
        </p>
      </div>

      {active.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Mini label="Activos" value={String(active.length)} i={0} />
          <Mini label="Próximas cuotas" value={formatCurrency(monthlyCrc)} i={1} />
          <Mini label="Cuotas por cobrar" value={formatCurrency(pendingCrc)} i={2} />
        </div>
      ) : null}

      {active.length === 0 ? (
        <EmptyRows>No tienes financiamientos activos.</EmptyRows>
      ) : (
        <FinancingList
          financings={active.map(({ f }) => f)}
          transactions={transactions}
          today={today}
          categories={categoryNames(catData ?? [], EXPENSE_CATEGORIES)}
          cardNames={cardNames}
        />
      )}
    </div>
  );
}

function Mini({ label, value, i }: { label: string; value: string; i: number }) {
  return (
    <div className="surface rise flex flex-col gap-1 p-4" style={{ ["--rise-i" as string]: i }}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tracking-tight tabular-nums">{value}</span>
    </div>
  );
}
