import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  chargeDueDate,
  crToday,
  financingProgress,
  installmentParts,
  storedInstallments,
  toISODate,
} from "@/domain";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { categoryNames } from "@/lib/categories";
import type { CreditCard, Financing, Member } from "@/lib/types";
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
import { FinancingEditDialog } from "../../../_financiamientos/financing-form";
import { rateLabel } from "../../../_financiamientos/financing-list";
import {
  ReimburseDialog,
  ReimbursedBadge,
  SharesDialog,
} from "../../../_financiamientos/member-actions";

type Cuota = { installment_no: number; occurred_on: string; amount: number; interest_amount: number | null };
type Share = { member_id: string; amount: number };
type Reimbursement = { id: string; member_id: string; installment_no: number; paid_on: string };

export default async function FinancingDetailPage({
  params,
}: PageProps<"/procesos/tarjetas/[id]/financiamientos/[financingId]">) {
  await requireUser();
  const { id: cardId, financingId } = await params;

  const supabase = await createClient();
  const [
    { data: finData },
    { data: cardData },
    { data: cuotaData },
    { data: memberData },
    { data: shareData },
    { data: reimbData },
    { data: catData },
  ] = await Promise.all([
    supabase
      .from("financings")
      .select("*")
      .eq("id", financingId)
      .eq("card_id", cardId)
      .eq("archived", false)
      .maybeSingle(),
    supabase.from("credit_cards").select("*").eq("id", cardId).maybeSingle(),
    supabase
      .from("transactions")
      .select("installment_no, occurred_on, amount, interest_amount")
      .eq("financing_id", financingId)
      .eq("archived", false),
    supabase.from("members").select("*").order("name", { ascending: true }),
    supabase
      .from("financing_shares")
      .select("member_id, amount")
      .eq("financing_id", financingId)
      .eq("archived", false),
    supabase
      .from("member_reimbursements")
      .select("id, member_id, installment_no, paid_on")
      .eq("financing_id", financingId)
      .eq("archived", false),
    supabase
      .from("categories")
      .select("name")
      .eq("kind", "expense")
      .eq("archived", false)
      .order("name", { ascending: true }),
  ]);

  if (!finData || !cardData) notFound();
  const financing = finData as Financing;
  const card = cardData as CreditCard;
  const currency = financing.currency;
  const todayISO = toISODate(crToday());
  const categories = categoryNames(catData ?? [], EXPENSE_CATEGORIES);

  const cuotas = ((cuotaData ?? []) as Cuota[]).map((c) => ({
    ...c,
    installment_no: Number(c.installment_no),
  }));
  const p = financingProgress(
    storedInstallments(cuotas, financing.months, Number(financing.total_amount)),
    todayISO,
  );
  const withInterest = p.totalInterest > 0;

  const allMembers = (memberData ?? []) as Member[];
  const membersById = new Map(allMembers.map((m) => [m.id, m]));
  const shares = ((shareData ?? []) as Share[]).map((s) => ({ ...s, amount: Number(s.amount) }));
  const shareMembers = shares
    .map((s) => ({ ...s, member: membersById.get(s.member_id) }))
    .filter((s): s is Share & { member: Member } => Boolean(s.member));
  const reimbursed = new Map(
    ((reimbData ?? []) as Reimbursement[]).map((r) => [`${r.member_id}:${Number(r.installment_no)}`, r]),
  );
  const shareOptions = allMembers.filter(
    (m) => !m.archived || shares.some((s) => s.member_id === m.id),
  );
  const minInstallment = Math.min(...p.installments.map((c) => c.amount));
  const cancelled = Boolean(financing.cancelled_on);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/procesos/tarjetas/${card.id}`} label={card.name} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            {financing.description}
            {cancelled ? (
              <Badge variant="outline">Cancelado el {formatDate(financing.cancelled_on!)}</Badge>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[
              financing.category,
              `${formatCurrency(Number(financing.total_amount), currency)} · ${rateLabel(financing.annual_rate)}`,
              `${financing.months} meses desde el ${formatDate(financing.first_charge_on)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {cancelled ? null : <FinancingEditDialog financing={financing} categories={categories} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          title="Cuota"
          value={formatCurrency((p.next ?? p.installments[0])?.amount ?? 0, currency)}
          hint={`${p.charged.length}/${financing.months} cobradas`}
        />
        <Stat
          title="Capital por cobrar"
          value={formatCurrency(p.remainingPrincipal, currency)}
          hint="resta al disponible de la tarjeta"
        />
        <Stat
          title="Próxima cuota"
          value={p.next ? formatDate(p.next.occurred_on) : "—"}
          hint={p.next ? `cuota ${p.next.no}` : cancelled ? undefined : "Completado"}
        />
        {withInterest ? (
          <>
            <Stat title="Interés cobrado" value={formatCurrency(p.interestCharged, currency)} />
            <Stat
              title="Interés por cobrar"
              value={formatCurrency(p.interestPending, currency)}
              hint="entra a la tarjeta con cada cuota"
            />
            <Stat
              title="Costo total"
              value={formatCurrency(p.totalCost, currency)}
              hint={`${formatCurrency(p.totalInterest, currency)} de intereses`}
            />
          </>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Reparto entre miembros</h2>
            <p className="text-sm text-muted-foreground">
              {shareMembers.length === 0
                ? "Pagás vos todas las cuotas."
                : shareMembers
                    .map((s) => `${s.member.name} ${formatCurrency(s.amount, currency)}`)
                    .concat(`vos ${formatCurrency(installmentParts(p.next?.amount ?? minInstallment, shares).own, currency)}`)
                    .join(" · ") + " por cuota"}
            </p>
          </div>
          <SharesDialog
            financingId={financing.id}
            currency={currency}
            minInstallment={minInstallment}
            members={shareOptions.map((m) => ({ id: m.id, name: m.archived ? `${m.name} (desactivado)` : m.name }))}
            shares={Object.fromEntries(shares.map((s) => [s.member_id, s.amount]))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          {withInterest ? "Tabla de amortización" : "Cuotas"}
        </h2>
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Cuota</TableHead>
                {withInterest ? (
                  <>
                    <TableHead className="text-right">Interés</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                  </>
                ) : null}
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                {shareMembers.map((s) => (
                  <TableHead key={s.member_id}>{s.member.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.installments.map((c) => {
                const charged = c.occurred_on <= todayISO;
                return (
                  <TableRow key={c.no} className={cn(charged && "text-muted-foreground")}>
                    <TableCell className="tabular-nums">{c.no}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(c.occurred_on)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.amount, currency)}
                    </TableCell>
                    {withInterest ? (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(c.interest, currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(c.principal, currency)}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.balance, currency)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {charged ? (
                        <span className="text-xs">Cobrada</span>
                      ) : c.no === p.next?.no ? (
                        <Badge variant="outline">Próxima</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Programada</span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        pagar antes del {formatDate(chargeDueDate(card, c.occurred_on))}
                      </span>
                    </TableCell>
                    {shareMembers.map((s) => {
                      const r = reimbursed.get(`${s.member_id}:${c.no}`);
                      return (
                        <TableCell key={s.member_id} className="whitespace-nowrap">
                          <span className="block text-xs tabular-nums">
                            {formatCurrency(s.amount, currency)}
                          </span>
                          {r ? (
                            <ReimbursedBadge id={r.id} paidOn={r.paid_on} />
                          ) : (
                            <ReimburseDialog
                              financingId={financing.id}
                              memberId={s.member_id}
                              memberName={s.member.name}
                              installmentNo={c.no}
                              months={financing.months}
                              amount={s.amount}
                              currency={currency}
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada cuota entra al estado de cuenta de la tarjeta en su fecha
          {withInterest ? " con su interés" : ""}. Los avisos a los miembros se
          envían desde Procesos → Cobros a miembros.
        </p>
      </section>
    </div>
  );
}

function Stat({ title, value, hint }: { title: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
