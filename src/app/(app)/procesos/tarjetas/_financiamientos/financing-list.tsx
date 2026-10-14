import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/delete-button";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { formatCurrency, formatDate } from "@/lib/format";
import { financingProgress, storedInstallments, toISODate } from "@/domain";
import type { Financing, Transaction } from "@/lib/types";
import { deleteFinancing } from "./actions";
import { FinancingEditDialog } from "./financing-form";

const CONFIRM =
  "¿Eliminar este financiamiento? Se borran las cuotas futuras (y su interés); las que ya se cobraron se conservan (podés quitarlas a mano).";

type Props = {
  financings: Financing[];
  transactions: Transaction[];
  today: Date;
  categories?: string[];
};

export function rateLabel(rate: number | undefined): string {
  const r = Number(rate ?? 0);
  return r > 0 ? `${r.toLocaleString("es-CR")} % anual` : "Tasa 0";
}

export function FinancingList({ financings, transactions, today, categories = [] }: Props) {
  if (financings.length === 0) return null;
  const todayISO = toISODate(today);

  const rows = financings.map((f) => {
    const cuotas = transactions
      .filter((t) => t.financing_id === f.id && t.installment_no != null)
      .map((t) => ({ ...t, installment_no: Number(t.installment_no) }));
    const p = financingProgress(
      storedInstallments(cuotas, f.months, Number(f.total_amount)),
      todayISO,
    );
    const payment = (p.next ?? p.installments[0])?.amount ?? 0;
    const status = f.cancelled_on
      ? `Cancelado el ${formatDate(f.cancelled_on)} · ${p.installments.length} cuota(s) conservada(s)`
      : p.next
        ? formatDate(p.next.occurred_on)
        : "Completado";
    const href = `/procesos/tarjetas/${f.card_id}/financiamientos/${f.id}`;
    return { f, p, payment, status, href };
  });

  const actions = (f: Financing) =>
    f.cancelled_on ? null : (
      <div className="flex justify-end gap-1">
        <FinancingEditDialog financing={f} categories={categories} />
        <DeleteButton id={f.id} action={deleteFinancing} confirmLabel={CONFIRM} />
      </div>
    );

  return (
    <>
      <div className="surface hidden overflow-hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Cuota</TableHead>
              <TableHead className="text-right">Restantes</TableHead>
              <TableHead>Próxima cuota</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ f, p, payment, status, href }) => (
              <TableRow key={f.id}>
                <TableCell>
                  <Link href={href} className="font-medium hover:underline">
                    {f.description}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {[f.category, rateLabel(f.annual_rate)].filter(Boolean).join(" · ")}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(f.total_amount, f.currency)}
                  {p.totalInterest > 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      + {formatCurrency(p.totalInterest, f.currency)} interés
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(payment, f.currency)}
                  <span className="block text-xs text-muted-foreground">
                    / {f.months} meses
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.scheduled.length}
                </TableCell>
                <TableCell className="text-muted-foreground">{status}</TableCell>
                <TableCell>{actions(f)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {rows.map(({ f, p, payment, status, href }) => (
          <MobileCard
            key={f.id}
            title={
              <Link href={href} className="hover:underline">
                {f.description}
              </Link>
            }
            meta={[f.category, rateLabel(f.annual_rate)].filter(Boolean).join(" · ")}
            actions={actions(f) ?? undefined}
          >
            <MobileField
              label="Capital"
              value={
                p.totalInterest > 0
                  ? `${formatCurrency(f.total_amount, f.currency)} + ${formatCurrency(p.totalInterest, f.currency)} interés`
                  : formatCurrency(f.total_amount, f.currency)
              }
            />
            <MobileField
              label="Cuota"
              value={`${formatCurrency(payment, f.currency)} / ${f.months} meses`}
            />
            <MobileField label="Restantes" value={p.scheduled.length} />
            <MobileField label="Próxima cuota" value={status} />
          </MobileCard>
        ))}
      </MobileList>
    </>
  );
}
