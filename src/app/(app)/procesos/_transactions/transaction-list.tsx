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
import { originLabel } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import { TransactionRowActions } from "./transaction-row-actions";

type Props = {
  transactions: Transaction[];
  accounts: Account[];
  cards: CreditCard[];
  /** Categorías para el selector del editar (gastos/ingresos o cargos de tarjeta). */
  categories?: string[];
  /** "list" = vista de gastos/ingresos · "card" = historial dentro de una tarjeta. */
  context?: "list" | "card";
  emptyLabel?: string;
};

/** Monto con signo según el contexto (flujo de caja vs. deuda de la tarjeta). */
function displayAmount(t: Transaction, context: "list" | "card"): number {
  if (context === "card") {
    return t.type === "card_payment" ? -Number(t.amount) : Number(t.amount);
  }
  return signedAmount(t);
}

export function TransactionList({
  transactions,
  accounts,
  cards,
  categories = [],
  context = "list",
  emptyLabel = "Aún no hay movimientos.",
}: Props) {
  const isCard = context === "card";

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
    const detail = isOpening
      ? "Saldo inicial"
      : isCard
        ? t.type === "card_payment"
          ? `Desde ${originLabel(t, accounts, cards)}`
          : (t.category ?? "Cargo")
        : originLabel(t, accounts, cards);
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
    const actions = isInstallment ? (
      <span className="text-xs text-muted-foreground">Ver en Financiamientos</span>
    ) : isOpening ? (
      <span className="text-xs text-muted-foreground">Se edita en la tarjeta</span>
    ) : (
      <TransactionRowActions
        transaction={t}
        accounts={accounts}
        cards={cards}
        categories={categories}
      />
    );
    return { t, amount, isInstallment, detail, typeBadge, actions };
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
                    <span className="font-medium">{t.category ?? "—"}</span>
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
              value={isCard ? typeBadge : (t.category ?? "—")}
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
