import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { formatCurrency, formatDate } from "@/lib/format";
import { signedAmount } from "@/domain";
import { originLabel, productLabel, touchesInactive } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import { DeleteButton } from "@/components/delete-button";
import { TransactionRowActions } from "./transaction-row-actions";
import { deleteTransaction } from "./actions";

type Props = {
  transactions: Transaction[];
  /**
   * Todas las cuentas y tarjetas, también las desactivadas: se usan para
   * nombrar el origen; los formularios de editar solo ofrecen las activas.
   */
  accounts: Account[];
  cards: CreditCard[];
  /** Categorías para el selector del editar (gastos/ingresos o cargos de tarjeta). */
  categories?: string[];
  /** "list" = vista de gastos/ingresos · "card" = historial dentro de una tarjeta. */
  context?: "list" | "card";
  emptyLabel?: string;
  /** Financiamientos cancelados: sus cuotas conservadas se pueden quitar a mano (F4). */
  cancelledFinancingIds?: string[];
};

/** Monto con signo según el contexto (flujo de caja vs. deuda de la tarjeta). */
function displayAmount(t: Transaction, context: "list" | "card"): number {
  // Una transferencia no es entrada ni salida neta: se muestra el monto movido.
  if (t.type === "transfer") return Number(t.amount);
  if (context === "card") {
    return t.type === "card_payment" ? -Number(t.amount) : Number(t.amount);
  }
  return signedAmount(t);
}

function concept(t: Transaction): string {
  if (t.type === "transfer") return "Transferencia";
  return t.category ?? "—";
}

export function TransactionList({
  transactions,
  accounts,
  cards,
  categories = [],
  context = "list",
  emptyLabel = "Aún no hay movimientos.",
  cancelledFinancingIds = [],
}: Props) {
  const isCard = context === "card";
  const activeAccounts = accounts.filter((a) => !a.archived);
  const activeCards = cards.filter((c) => !c.archived);

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="py-10 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  const rows = transactions.map((t) => {
    const amount = displayAmount(t, context);
    const isInstallment = Boolean(t.financing_id);
    const isOpening = t.type === "opening_balance";
    const sinpeTo = [t.counterparty_name, t.counterparty_phone].filter(Boolean).join(" · ");
    const detail = isOpening
      ? "Saldo inicial"
      : t.type === "transfer"
        ? `${originLabel(t, accounts, cards)} → ${
            productLabel(accounts.find((a) => a.id === t.to_account_id))
          }`
        : t.channel === "sinpe"
          ? `${originLabel(t, accounts, cards)} · SINPE${sinpeTo ? ` a ${sinpeTo}` : ""}`
          : isCard
        ? t.type === "card_payment"
          ? `Desde ${originLabel(t, accounts, cards)}`
          : (t.category ?? "Cargo")
        : originLabel(t, accounts, cards);
    const interest = Number(t.interest_amount ?? 0);
    const detailWithInterest =
      interest > 0 ? `${detail} · incluye ${formatCurrency(interest, t.currency)} de interés` : detail;
    const typeBadge = isCard ? (
      <Badge
        variant={
          t.type === "card_payment" || isInstallment || isOpening ? "secondary" : "outline"
        }
      >
        {t.type === "card_payment"
          ? "Pago"
          : isOpening
            ? "Saldo inicial"
            : isInstallment
              ? "Cuota"
              : "Cargo"}
      </Badge>
    ) : null;
    const fromCancelledPlan =
      isInstallment && cancelledFinancingIds.includes(t.financing_id!);
    const actions = fromCancelledPlan ? (
      <div className="flex justify-end">
        <DeleteButton
          id={t.id}
          action={deleteTransaction}
          confirmLabel="¿Quitar esta cuota de un financiamiento cancelado?"
        />
      </div>
    ) : isInstallment && t.card_id ? (
      <Link
        href={`/procesos/tarjetas/${t.card_id}/financiamientos/${t.financing_id}`}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Ver en Financiamientos
      </Link>
    ) : isOpening ? (
      <span className="text-xs text-muted-foreground">Se edita en la tarjeta</span>
    ) : t.loan_id ? (
      <Link
        href={`/procesos/prestamos/${t.loan_id}`}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Ver en Préstamos
      </Link>
    ) : touchesInactive(t, accounts, cards) ? (
      <span className="text-xs text-muted-foreground">Desactivada: actívala para editar</span>
    ) : (
      <TransactionRowActions
        transaction={t}
        accounts={activeAccounts}
        cards={activeCards}
        categories={categories}
      />
    );
    return { t, amount, isInstallment, detail: detailWithInterest, typeBadge, actions };
  });

  return (
    <>
      <div className="hidden rounded-lg border sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>{isCard ? "Tipo" : "Concepto"}</TableHead>
            <TableHead>{isCard ? "Detalle" : "Origen"}</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ t, amount, detail, typeBadge, actions }) => (
            <TableRow key={t.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(t.occurred_on)}
              </TableCell>
              <TableCell>
                {isCard ? (
                  typeBadge
                ) : (
                  <>
                    <span className="font-medium">{concept(t)}</span>
                    {t.note ? (
                      <span className="block text-xs text-muted-foreground">
                        {t.note}
                      </span>
                    ) : null}
                  </>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {detail}
                {isCard && t.note ? (
                  <span className="block text-xs">{t.note}</span>
                ) : null}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  amount < 0 && "text-destructive",
                )}
              >
                {formatCurrency(amount, t.currency)}
              </TableCell>
              <TableCell>{actions}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <MobileList>
        {rows.map(({ t, amount, detail, typeBadge, actions }) => (
          <MobileCard
            key={t.id}
            title={formatDate(t.occurred_on)}
            actions={actions}
          >
            <MobileField
              label={isCard ? "Tipo" : "Concepto"}
              value={isCard ? typeBadge : concept(t)}
            />
            <MobileField label={isCard ? "Detalle" : "Origen"} value={detail} />
            {t.note ? <MobileField label="Nota" value={t.note} /> : null}
            <MobileField
              label="Monto"
              value={
                <span className={cn(amount < 0 && "text-destructive")}>
                  {formatCurrency(amount, t.currency)}
                </span>
              }
            />
          </MobileCard>
        ))}
      </MobileList>
    </>
  );
}
