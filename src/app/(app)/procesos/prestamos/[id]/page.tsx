import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { crToday, loanProgress, toISODate } from "@/domain";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { LoanRenameDialog } from "../loan-form";
import { LoanStatusBadge } from "../loan-status";
import { PayInstallmentDialog, UndoLastPaymentButton } from "../pay-installment";
import { ChangeRateDialog, PrepayLoanDialog, UndoAdjustmentButton } from "../loan-adjustments";
import { repositories } from "@/infrastructure/container";

type Payment = { installment_no: number; occurred_on: string };

export default async function LoanDetailPage({ params }: PageProps<"/procesos/prestamos/[id]">) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: loanData }, { data: payData }, { data: accData }] = await Promise.all([
    supabase.from("loans").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("transactions")
      .select("installment_no, occurred_on")
      .eq("loan_id", id)
      .not("installment_no", "is", null)
      .eq("archived", false),
    supabase
      .from("accounts")
      .select("id, name, currency")
      .eq("archived", false)
      .order("created_at", { ascending: true }),
  ]);

  if (!loanData) notFound();
  const loan = loanData as Loan;
  const currency = loan.currency === "USD" ? "USD" : "CRC";
  const payments = (payData ?? []) as Payment[];
  const paidOn = new Map(payments.map((p) => [Number(p.installment_no), p.occurred_on]));
  const accounts = (accData ?? []) as Pick<Account, "id" | "name" | "currency">[];
  const payAccounts = accounts.filter((a) => a.currency === currency);

  const todayISO = toISODate(crToday());
  // L7/L8 (3.1.0): abonos y cambios de tasa recalculan el calendario.
  const adjustments = await (await repositories()).loans.adjustments(loan.id);
  const p = loanProgress(
    termsOf({ ...loan, currency }, adjustments.map((a) => a.event)),
    paidOn.keys(),
    todayISO,
  );
  const { schedule } = p;
  const lastAdjustment = adjustments.at(-1);
  const currentRate = [...adjustments]
    .reverse()
    .map((a) => a.event)
    .find((e) => e.kind === "rate");

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos/prestamos" label="Préstamos" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {loan.name}
            {loan.archived ? <Badge variant="outline">Desactivado</Badge> : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[
              loan.lender,
              `${formatCurrency(Number(loan.principal), currency)} al ${Number(loan.annual_rate)} % anual`,
              `${loan.months} meses`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {loan.archived ? null : <LoanRenameDialog loan={loan} accounts={accounts} />}
      </div>

      {p.status === "atrasado" ? (
        <Alert tone="danger">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm font-medium">
            {p.overdue.length === 1
              ? `La cuota ${p.overdue[0].no} venció el ${formatDate(p.overdue[0].occurred_on)}.`
              : `${p.overdue.length} cuotas vencidas, desde el ${formatDate(p.overdue[0].occurred_on)}.`}{" "}
            Falta pagar {formatCurrency(p.overdue.reduce((s, r) => s + r.payment, 0), currency)}.
          </p>
        </Alert>
      ) : p.status === "pagado" ? (
        <Alert tone="ok">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-foreground/70" />
          <p className="text-sm font-medium">Préstamo pagado por completo.</p>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          title={adjustments.length > 0 ? "Cuota" : "Cuota fija"}
          value={formatCurrency(p.next?.payment ?? schedule.payment, currency)}
          hint={currentRate && currentRate.kind === "rate" ? `tasa actual ${currentRate.annualRatePercent} % anual` : undefined}
        />
        <Stat
          title="Capital pendiente"
          value={formatCurrency(p.remainingPrincipal, currency)}
          hint={`${p.paidCount}/${schedule.rows.length} cuotas pagadas`}
        />
        <Stat
          title="Próxima cuota"
          value={p.next ? formatDate(p.next.occurred_on) : "—"}
          hint={p.next ? `cuota ${p.next.no}` : undefined}
          emphasis={p.status === "atrasado" ? "danger" : undefined}
        />
        <Stat title="Intereses pagados" value={formatCurrency(p.interestPaid, currency)} />
        <Stat title="Intereses por pagar" value={formatCurrency(p.interestPending, currency)} />
        <Stat
          title="Costo total"
          value={formatCurrency(schedule.totalPaid, currency)}
          hint={`${formatCurrency(schedule.totalInterest, currency)} de intereses`}
        />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Calendario de cuotas</h2>
          {loan.archived ? null : (
            <div className="flex flex-wrap gap-2">
              {p.paidCount > 0 ? (
                <UndoLastPaymentButton loanId={loan.id} installmentNo={p.paidCount} />
              ) : null}
              {lastAdjustment ? (
                <UndoAdjustmentButton
                  loanId={loan.id}
                  label={
                    lastAdjustment.event.kind === "prepayment"
                      ? `Abono de ${formatCurrency(lastAdjustment.event.amount, currency)} del ${formatDate(lastAdjustment.occurred_on)}`
                      : `Tasa ${lastAdjustment.event.annualRatePercent} % desde la cuota ${lastAdjustment.event.fromNo}`
                  }
                />
              ) : null}
              {p.next ? (
                <>
                  <ChangeRateDialog
                    loanId={loan.id}
                    nextNo={p.next.no}
                    lastNo={schedule.rows.length}
                    currentRate={currentRate && currentRate.kind === "rate" ? currentRate.annualRatePercent : Number(loan.annual_rate)}
                  />
                  <PrepayLoanDialog
                    loanId={loan.id}
                    currency={currency}
                    remainingPrincipal={p.remainingPrincipal}
                    accounts={payAccounts}
                    defaultAccountId={loan.account_id}
                  />
                </>
              ) : null}
              {p.next ? (
                <PayInstallmentDialog
                  loanId={loan.id}
                  row={p.next}
                  months={loan.months}
                  currency={currency}
                  accounts={payAccounts}
                  defaultAccountId={loan.account_id}
                />
              ) : null}
            </div>
          )}
        </div>
        {!loan.archived && p.next && payAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Necesitás una cuenta activa en {currency} para pagar las cuotas.
          </p>
        ) : null}

        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Cuota</TableHead>
                <TableHead className="text-right">Interés</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.rows.map((r) => {
                const paidDate = r.no <= p.paidCount ? paidOn.get(r.no) : undefined;
                const overdue = !paidDate && r.occurred_on < todayISO;
                return (
                  <TableRow key={r.no} className={cn(paidDate && "text-muted-foreground")}>
                    <TableCell className="tabular-nums">{r.no}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(r.occurred_on)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.payment, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.interest, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.principal, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.balance, currency)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {paidDate ? (
                        <span className="text-xs">Pagada el {formatDate(paidDate)}</span>
                      ) : overdue ? (
                        <Badge variant="destructive">Vencida</Badge>
                      ) : r.no === p.next?.no ? (
                        <Badge variant="outline">Próxima</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pendiente</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Estado: <LoanStatusBadge status={p.status} overdue={p.overdue.length} /> · Cada
          pago y cada abono extraordinario se registra como gasto en categoría “Préstamos” y
          aparece en Gastos.
          {adjustments.length > 0
            ? ` Ajustes: ${adjustments
                .map((a) =>
                  a.event.kind === "prepayment"
                    ? `abono de ${formatCurrency(a.event.amount, currency)} el ${formatDate(a.occurred_on)} (${a.event.mode === "term" ? "bajó el plazo" : "bajó la cuota"})`
                    : `tasa ${a.event.annualRatePercent} % desde la cuota ${a.event.fromNo}`,
                )
                .join(" · ")}.`
            : ""}
        </p>
      </section>
    </div>
  );
}

function Alert({ tone, children }: { tone: "danger" | "ok"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl p-4",
        tone === "danger"
          ? "border border-destructive/30 bg-destructive/5 dark:bg-destructive/10"
          : "surface",
      )}
    >
      {children}
    </div>
  );
}

function Stat({
  title,
  value,
  hint,
  emphasis,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  emphasis?: "danger";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-xl font-semibold tabular-nums",
            emphasis === "danger" && "text-destructive",
          )}
        >
          {value}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
