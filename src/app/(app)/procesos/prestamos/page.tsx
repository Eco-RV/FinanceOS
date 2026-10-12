import Link from "next/link";
import { Eye } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, relativeDayLabel } from "@/lib/format";
import { crToday, daysUntil, fromISODate, loanProgress, toISODate } from "@/domain";
import { termsOf } from "@/application";
import type { Account, Loan } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const rows = all
    .filter((l) => !l.archived)
    .map((loan) => {
      const terms = termsOf({ ...loan, currency: loan.currency === "USD" ? "USD" : "CRC" });
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
          <h1 className="text-2xl font-semibold">Préstamos</h1>
          <p className="text-sm text-muted-foreground">
            Deudas con el banco a cuota fija: calendario, intereses y pagos.
          </p>
        </div>
        <LoanFormDialog accounts={accounts} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no tienes préstamos. Agrega el primero.
        </div>
      ) : (
        <>
          <div className="hidden rounded-lg border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Préstamo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Cuota</TableHead>
                  <TableHead>Próxima cuota</TableHead>
                  <TableHead className="text-right">Capital pendiente</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ loan, p }) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <Link href={`/procesos/prestamos/${loan.id}`} className="font-medium hover:underline">
                        {loan.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[loan.lender, `${p.paidCount}/${loan.months} cuotas`].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <LoanStatusBadge status={p.status} overdue={p.overdue.length} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(p.schedule.payment, loan.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{nextLabel(p)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(p.remainingPrincipal, loan.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">{actions(loan)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <MobileList>
            {rows.map(({ loan, p }) => (
              <MobileCard
                key={loan.id}
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
