import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { originLabel, signedAmount } from "@/lib/transactions";
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

  return (
    <div className="rounded-lg border">
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
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-10 text-center text-muted-foreground"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((t) => {
              const amount = displayAmount(t, context);
              const isInstallment = Boolean(t.financing_id);
              const detail = isCard
                ? t.type === "card_payment"
                  ? `Desde ${originLabel(t, accounts, cards)}`
                  : (t.category ?? "Cargo")
                : originLabel(t, accounts, cards);
              return (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(t.occurred_on)}
                  </TableCell>
                  <TableCell>
                    {isCard ? (
                      <Badge
                        variant={
                          t.type === "card_payment"
                            ? "secondary"
                            : isInstallment
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {t.type === "card_payment"
                          ? "Pago"
                          : isInstallment
                            ? "Cuota"
                            : "Cargo"}
                      </Badge>
                    ) : (
                      <>
                        <span className="font-medium">
                          {t.category ?? "—"}
                        </span>
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
                  <TableCell>
                    {isInstallment ? (
                      <span className="block text-right text-xs text-muted-foreground">
                        Ver en Financiamientos
                      </span>
                    ) : (
                      <TransactionRowActions
                        transaction={t}
                        accounts={accounts}
                        cards={cards}
                        categories={categories}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
