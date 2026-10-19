import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyRows, RowActions, RowItem, RowList } from "@/components/row-list";
import { CategoryBadge } from "@/components/category-icon";
import { defaultIconFor, type CategoryIconKey } from "@/lib/category-icon-keys";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { formatCurrency, formatDate } from "@/lib/format";
import { debitCardLabel, signedAmount } from "@/domain";
import { originLabel, productLabel, touchesInactive } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import type { Account, CreditCard, DebitCard, Transaction } from "@/lib/types";
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
  /**
   * "list" = vista de gastos/ingresos · "card" = historial dentro de una
   * tarjeta · "account" = historial de una cuenta (2.8.0, con `accountId`).
   */
  context?: "list" | "card" | "account";
  /** Cuenta del historial (contexto "account"): da el signo de las transferencias. */
  accountId?: string;
  /** Tarjetas de débito (también desactivadas) para nombrarlas y editar gastos (2.8.0). */
  debitCards?: DebitCard[];
  emptyLabel?: string;
  /** Financiamientos cancelados: sus cuotas conservadas se pueden quitar a mano (F4). */
  cancelledFinancingIds?: string[];
  /** Nombre de categoría (minúsculas) → ícono (2.5.0). */
  categoryIcons?: Record<string, CategoryIconKey>;
};

/** Monto con signo según el contexto (flujo de caja vs. deuda de la tarjeta). */
export function displayAmount(
  t: Transaction,
  context: "list" | "card" | "account",
  accountId?: string,
): { amount: number; currency: string } {
  // M5 (2.8.0): un abono convertido sale de la cuenta en la moneda de la cuenta.
  if (context === "account" && t.type === "card_payment" && t.account_amount != null) {
    const accountCurrency = t.currency === "USD" ? "CRC" : "USD";
    return { amount: -Number(t.account_amount), currency: accountCurrency };
  }
  if (t.type === "transfer") {
    // En una cuenta: sale (origen) o entra (destino). En listas: el monto movido.
    const sign = context === "account" && t.account_id === accountId ? -1 : 1;
    return { amount: sign * Number(t.amount), currency: t.currency };
  }
  if (context === "card") {
    return {
      amount: t.type === "card_payment" ? -Number(t.amount) : Number(t.amount),
      currency: t.currency,
    };
  }
  return { amount: signedAmount(t), currency: t.currency };
}

function concept(t: Transaction): string {
  if (t.type === "transfer") return "Transferencia";
  if (t.type === "card_payment") return "Pago de tarjeta";
  if (t.type === "opening_balance") return "Saldo inicial";
  return t.category ?? "—";
}

export function TransactionList({
  transactions,
  accounts,
  cards,
  categories = [],
  context = "list",
  accountId,
  debitCards = [],
  emptyLabel = "Aún no hay movimientos.",
  cancelledFinancingIds = [],
  categoryIcons = {},
}: Props) {
  const debitById = new Map(debitCards.map((d) => [d.id, d]));
  const activeDebitCards = debitCards.filter((d) => !d.archived);
  const iconOf = (t: Transaction): CategoryIconKey =>
    t.type === "transfer"
      ? "repeat"
      : t.category
        ? (categoryIcons[t.category.trim().toLowerCase()] ?? defaultIconFor(t.category))
        : "tag";
  const isCard = context === "card";
  const activeAccounts = accounts.filter((a) => !a.archived);
  const activeCards = cards.filter((c) => !c.archived);

  if (transactions.length === 0) {
    return <EmptyRows>{emptyLabel}</EmptyRows>;
  }

  const rows = transactions.map((t) => {
    const { amount, currency: amountCurrency } = displayAmount(t, context, accountId);
    const debit = t.debit_card_id ? debitById.get(t.debit_card_id) : undefined;
    const conversion =
      t.type === "card_payment" && t.account_amount != null && t.exchange_rate
        ? ` · ${formatCurrency(Number(t.account_amount), t.currency === "USD" ? "CRC" : "USD")} con $1 = ${formatCurrency(Number(t.exchange_rate), "CRC")}`
        : "";
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
          ? `Desde ${originLabel(t, accounts, cards)}${conversion}`
          : (t.category ?? "Cargo")
        : t.type === "card_payment"
          ? `Abono a ${productLabel(cards.find((c) => c.id === t.card_id))}${conversion}`
          : debit
            ? `${originLabel(t, accounts, cards)} · ${debitCardLabel(debit)}`
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
      <span className="text-xs text-muted-foreground">
        Se edita en {context === "account" ? "la cuenta" : "la tarjeta"}
      </span>
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
        categoryIcons={categoryIcons}
        debitCards={activeDebitCards}
      />
    );
    return { t, amount, amountCurrency, isInstallment, detail: detailWithInterest, typeBadge, actions };
  });

  return (
    <>
      <RowList
        columns={
          isCard
            ? "6.5rem minmax(0,0.8fr) minmax(0,2fr) minmax(0,1fr) 9.5rem"
            : "6.5rem minmax(0,1.6fr) minmax(0,1.4fr) minmax(0,1fr) 9.5rem"
        }
        headers={[
          { label: "Fecha" },
          { label: isCard ? "Tipo" : "Concepto" },
          { label: isCard ? "Detalle" : "Origen" },
          { label: "Monto", align: "right" },
          {},
        ]}
      >
        {rows.map(({ t, amount, amountCurrency, detail, typeBadge, actions }, i) => (
          <RowItem key={t.id} index={i}>
            <span className="whitespace-nowrap text-muted-foreground">
              {formatDate(t.occurred_on)}
            </span>
            {isCard ? (
              <div>{typeBadge}</div>
            ) : (
              <div className="flex min-w-0 items-center gap-2.5">
                <CategoryBadge icon={iconOf(t)} size="sm" />
                <div className="min-w-0">
                  <span className="block truncate font-medium">{concept(t)}</span>
                  {t.note ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.note}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            <div className="min-w-0 text-muted-foreground">
              <span className="line-clamp-2">{detail}</span>
              {isCard && t.note ? <span className="block truncate text-xs">{t.note}</span> : null}
            </div>
            <span
              className={cn(
                "text-right font-medium tabular-nums",
                amount < 0 && "text-destructive",
              )}
            >
              {formatCurrency(amount, amountCurrency)}
            </span>
            <RowActions>{actions}</RowActions>
          </RowItem>
        ))}
      </RowList>

      <MobileList>
        {rows.map(({ t, amount, amountCurrency, detail, typeBadge, actions }, i) => (
          <MobileCard
            key={t.id}
            index={i}
            title={
              isCard ? (
                formatDate(t.occurred_on)
              ) : (
                <span className="flex items-center gap-2">
                  <CategoryBadge icon={iconOf(t)} size="sm" />
                  {concept(t)}
                </span>
              )
            }
            meta={isCard ? undefined : formatDate(t.occurred_on)}
            actions={actions}
          >
            {isCard ? <MobileField label="Tipo" value={typeBadge} /> : null}
            <MobileField label={isCard ? "Detalle" : "Origen"} value={detail} />
            {t.note ? <MobileField label="Nota" value={t.note} /> : null}
            <MobileField
              label="Monto"
              value={
                <span className={cn("font-medium", amount < 0 && "text-destructive")}>
                  {formatCurrency(amount, amountCurrency)}
                </span>
              }
            />
          </MobileCard>
        ))}
      </MobileList>
    </>
  );
}
