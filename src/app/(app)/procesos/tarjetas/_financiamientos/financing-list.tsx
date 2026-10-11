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
import { toISODate } from "@/domain";
import type { Financing, Transaction } from "@/lib/types";
import { deleteFinancing } from "./actions";

const CONFIRM =
  "¿Eliminar este financiamiento? Se borran las cuotas futuras; las que ya se cobraron se conservan (podés quitarlas a mano).";

type Props = {
  financings: Financing[];
  transactions: Transaction[];
  today: Date;
};

export function FinancingList({ financings, transactions, today }: Props) {
  if (financings.length === 0) return null;
  const todayISO = toISODate(today);

  const rows = financings.map((f) => {
    const installments = transactions
      .filter((t) => t.financing_id === f.id)
      .sort((a, b) => (a.occurred_on < b.occurred_on ? -1 : 1));
    const pending = installments.filter((t) => t.occurred_on > todayISO);
    const monthlyAmount = f.total_amount / f.months;
    const status = f.cancelled_on
      ? `Cancelado el ${formatDate(f.cancelled_on)} · ${installments.length} cuota(s) conservada(s)`
      : pending[0]
        ? formatDate(pending[0].occurred_on)
        : "Completado";
    return { f, pending, monthlyAmount, status };
  });

  return (
    <>
      <div className="hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Cuota</TableHead>
              <TableHead className="text-right">Restantes</TableHead>
              <TableHead>Próxima cuota</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ f, pending, monthlyAmount, status }) => (
              <TableRow key={f.id}>
                <TableCell>
                  <span className="font-medium">{f.description}</span>
                  {f.category ? (
                    <span className="block text-xs text-muted-foreground">
                      {f.category}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(f.total_amount, f.currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ≈ {formatCurrency(monthlyAmount, f.currency)}
                  <span className="block text-xs text-muted-foreground">
                    / {f.months} meses
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {pending.length}
                </TableCell>
                <TableCell className="text-muted-foreground">{status}</TableCell>
                <TableCell>
                  {f.cancelled_on ? null : (
                    <DeleteButton id={f.id} action={deleteFinancing} confirmLabel={CONFIRM} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {rows.map(({ f, pending, monthlyAmount, status }) => (
          <MobileCard
            key={f.id}
            title={f.description}
            meta={f.category ?? undefined}
            actions={
              f.cancelled_on ? undefined : (
                <DeleteButton id={f.id} action={deleteFinancing} confirmLabel={CONFIRM} />
              )
            }
          >
            <MobileField
              label="Total"
              value={formatCurrency(f.total_amount, f.currency)}
            />
            <MobileField
              label="Cuota"
              value={`≈ ${formatCurrency(monthlyAmount, f.currency)} / ${f.months} meses`}
            />
            <MobileField label="Restantes" value={pending.length} />
            <MobileField label="Próxima cuota" value={status} />
          </MobileCard>
        ))}
      </MobileList>
    </>
  );
}
