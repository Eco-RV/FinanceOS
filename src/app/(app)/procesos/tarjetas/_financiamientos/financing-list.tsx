import { RowActions, RowItem, RowList } from "@/components/row-list";
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
  /** Vista de todas las tarjetas (2.5.0): id de tarjeta → nombre, para mostrarla. */
  cardNames?: Record<string, string>;
};

export function rateLabel(rate: number | undefined): string {
  const r = Number(rate ?? 0);
  return r > 0 ? `${r.toLocaleString("es-CR")} % anual` : "Tasa 0";
}

export function FinancingList({
  financings,
  transactions,
  today,
  categories = [],
  cardNames,
}: Props) {
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
      <>
        <FinancingEditDialog financing={f} categories={categories} />
        <DeleteButton id={f.id} action={deleteFinancing} confirmLabel={CONFIRM} />
      </>
    );

  const meta = (f: Financing) =>
    [cardNames?.[f.card_id], f.category, rateLabel(f.annual_rate)].filter(Boolean).join(" · ");

  return (
    <>
      {/* 2.5.0: toda la fila abre el detalle del financiamiento. */}
      <RowList
        columns="minmax(0,2fr) minmax(0,1.1fr) minmax(0,1fr) 5.5rem minmax(0,1.2fr) 5.5rem"
        headers={[
          { label: "Descripción" },
          { label: "Capital", align: "right" },
          { label: "Cuota", align: "right" },
          { label: "Restantes", align: "right" },
          { label: "Próxima cuota" },
          {},
        ]}
      >
        {rows.map(({ f, p, payment, status, href }, i) => (
          <RowItem key={f.id} index={i} href={href} label={`Ver ${f.description}`}>
            <div className="min-w-0">
              <span className="block truncate font-medium">{f.description}</span>
              <span className="block truncate text-xs text-muted-foreground">{meta(f)}</span>
            </div>
            <div className="text-right tabular-nums">
              {formatCurrency(f.total_amount, f.currency)}
              {p.totalInterest > 0 ? (
                <span className="block text-xs text-muted-foreground">
                  + {formatCurrency(p.totalInterest, f.currency)} interés
                </span>
              ) : null}
            </div>
            <div className="text-right tabular-nums">
              {formatCurrency(payment, f.currency)}
              <span className="block text-xs text-muted-foreground">/ {f.months} meses</span>
            </div>
            <span className="text-right tabular-nums">{p.scheduled.length}</span>
            <span className="text-muted-foreground">{status}</span>
            <RowActions>{actions(f)}</RowActions>
          </RowItem>
        ))}
      </RowList>

      <MobileList>
        {rows.map(({ f, p, payment, status, href }, i) => (
          <MobileCard
            key={f.id}
            index={i}
            href={href}
            label={`Ver ${f.description}`}
            title={f.description}
            meta={meta(f)}
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
