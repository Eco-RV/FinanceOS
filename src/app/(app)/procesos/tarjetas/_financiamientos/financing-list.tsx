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
    return { f, pending, monthlyAmount };
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
            {rows.map(({ f, pending, monthlyAmount }) => (
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
                <TableCell className="text-muted-foreground">
                  {pending[0] ? formatDate(pending[0].occurred_on) : "Completado"}
                </TableCell>
                <TableCell>
                  <DeleteButton
                    id={f.id}
                    action={deleteFinancing}
                    confirmLabel="¿Eliminar este financiamiento? Se borrarán todas sus cuotas y se revertirá el saldo de la tarjeta."
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {rows.map(({ f, pending, monthlyAmount }) => (
          <MobileCard
            key={f.id}
            title={f.description}
            meta={f.category ?? undefined}
            actions={
              <DeleteButton
                id={f.id}
                action={deleteFinancing}
                confirmLabel="¿Eliminar este financiamiento? Se borrarán todas sus cuotas y se revertirá el saldo de la tarjeta."
              />
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
            <MobileField
              label="Próxima cuota"
              value={pending[0] ? formatDate(pending[0].occurred_on) : "Completado"}
            />
          </MobileCard>
        ))}
      </MobileList>
    </>
  );
}
