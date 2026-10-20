import Link from "next/link";
import { Eye } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, relativeDayLabel } from "@/lib/format";
import { crToday, daysUntil, fromISODate, loanProgress, toISODate } from "@/domain";
import { termsOf } from "@/application";
import { loadLoanAdjustments } from "@/lib/loan-adjustments";
import type { Account, Loan } from "@/lib/types";
import { RowActions, RowItem, RowList } from "@/components/row-list";
import { buttonVariants } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { InactiveList, RemoveOrDeactivate } from "@/components/catalog-actions";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { idsWithHistory } from "@/lib/catalog-history";
import { repositories } from "@/infrastructure/container";
import { LoanFormDialog, LoanRenameDialog } from "./loan-form";
import { LoanStatusBadge } from "./loan-status";
import { deleteLoan, setLoanActive } from "./actions";

type PaymentRow = { loan_id: string; installment_no: number };

export default async function PrestamosPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data: loanData }, { data: payData }, { data: accData }] = await Promise.all([
    supabase.from("loans").select("*").order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("loan_id, installment_no")
      .not("loan_id", "is", null)
      .not("installment_no", "is", null)
      .eq("archived", false),
    supabase
      .from("accounts")
      .select("id, name, currency")
      .eq("archived", false)
      .order("created_at", { ascending: true }),
  ]);

  const all = (loanData ?? []) as Loan[];
  const accounts = (accData ?? []) as Pick<Account, "id" | "name" | "currency">[];
  const paid = new Map<string, number[]>();
  for (const p of (payData ?? []) as PaymentRow[]) {
    paid.set(p.loan_id, [...(paid.get(p.loan_id) ?? []), Number(p.installment_no)]);
  }
  const withHistory = await idsWithHistory(
    (await repositories()).loans,
    all.map((l) => l.id),
  );
  const today = crToday();
  const todayISO = toISODate(today);

  const adjustments = await loadLoanAdjustments(supabase);
  const rows = all
    .filter((l) => !l.archived)
    .map((loan) => {
      const terms = termsOf(
        { ...loan, currency: loan.currency === "USD" ? "USD" : "CRC" },
        adjustments.get(loan.id) ?? [],
      );
      return { loan, p: loanProgress(terms, paid.get(loan.id) ?? [], todayISO) };
    });
  const inactive = all.filter((l) => l.archived);

  const actions = (loan: Loan) => (
    <>
      <Link
        href={`/procesos/prestamos/${loan.id}`}
        className={buttonVariants({ variant: "ghost", size: "icon" })}
        aria-label="Ver calendario"
        title="Ver calendario"
      >
        <Eye className="size-4" />
      </Link>
      <LoanRenameDialog loan={loan} accounts={accounts} />
      <RemoveOrDeactivate
        id={loan.id}
        label={`el préstamo "${loan.name}"`}
        hasHistory={withHistory.has(loan.id)}
        onDelete={deleteLoan}
        onSetActive={setLoanActive}
        deactivateNote="Útil cuando ya está liquidado."
      />
    </>
  );

  const nextLabel = (p: (typeof rows)[number]["p"]) =>
    p.next
      ? `${formatDate(p.next.occurred_on)} · ${relativeDayLabel(daysUntil(fromISODate(p.next.occurred_on), today))}`
      : "—";

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Préstamos</h1>
          <p className="text-sm text-muted-foreground">
            Deudas con el banco a cuota fija: calendario, intereses y pagos.
          </p>
        </div>
        <LoanFormDialog accounts={accounts} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no tienes préstamos. Agrega el primero.
        </div>
      ) : (
        <>
          <RowList
            columns="minmax(0,1.8fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.2fr) 8rem"
            headers={[
              { label: "Préstamo" },
              { label: "Estado" },
              { label: "Cuota", align: "right" },
              { label: "Próxima cuota" },
              { label: "Capital pendiente", align: "right" },
              {},
            ]}
          >
            {rows.map(({ loan, p }, i) => (
              <RowItem
                key={loan.id}
                index={i}
                href={`/procesos/prestamos/${loan.id}`}
                label={`Ver calendario de ${loan.name}`}
              >
                <div className="min-w-0">
                  <span className="block truncate font-medium">{loan.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[loan.lender, `${p.paidCount}/${loan.months} cuotas`].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div>
                  <LoanStatusBadge status={p.status} overdue={p.overdue.length} />
                </div>
                <span className="text-right tabular-nums">
                  {formatCurrency(p.schedule.payment, loan.currency)}
                </span>
                <span className="text-muted-foreground">{nextLabel(p)}</span>
                <span className="text-right font-medium tabular-nums">
                  {formatCurrency(p.remainingPrincipal, loan.currency)}
                </span>
                <RowActions>{actions(loan)}</RowActions>
              </RowItem>
            ))}
          </RowList>

          <MobileList>
            {rows.map(({ loan, p }, i) => (
              <MobileCard
                key={loan.id}
                index={i}
                href={`/procesos/prestamos/${loan.id}`}
                label={`Ver calendario de ${loan.name}`}
                title={loan.name}
                meta={loan.lender ?? undefined}
                actions={actions(loan)}
              >
                <MobileField
                  label="Estado"
                  value={<LoanStatusBadge status={p.status} overdue={p.overdue.length} />}
                />
                <MobileField label="Cuota" value={formatCurrency(p.schedule.payment, loan.currency)} />
                <MobileField label="Próxima" value={nextLabel(p)} />
                <MobileField
                  label="Capital pendiente"
                  value={formatCurrency(p.remainingPrincipal, loan.currency)}
                />
                <MobileField label="Avance" value={`${p.paidCount}/${loan.months} cuotas`} />
              </MobileCard>
            ))}
          </MobileList>
        </>
      )}

      <InactiveList
        title="Desactivados"
        items={inactive.map((l) => ({
          id: l.id,
          name: l.name,
          detail: l.lender ?? undefined,
          hasHistory: withHistory.has(l.id),
        }))}
        noun="el préstamo"
        onDelete={deleteLoan}
        onSetActive={setLoanActive}
      />
    </div>
  );
}
