"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { DeleteButton } from "@/components/delete-button";
import { buttonVariants } from "@/components/ui/button";
import type { Account, CreditCard, DebitCard, Transaction } from "@/lib/types";
import type { CategoryIconKey } from "@/lib/category-icon-keys";
import { TransactionForm } from "./transaction-form";
import { TransferForm } from "./transfer-form";
import { deleteTransaction } from "./actions";
import { ReceiptDialog } from "./receipt-dialog";

export function TransactionRowActions({
  transaction,
  accounts,
  cards,
  categories,
  categoryIcons,
  debitCards,
  canShare = false,
}: {
  transaction: Transaction;
  accounts: Account[];
  cards: CreditCard[];
  debitCards?: DebitCard[];
  categories?: string[];
  categoryIcons?: Record<string, CategoryIconKey>;
  /** 3.0.1: ofrecer "Compartir" (gasto sin compartir). */
  canShare?: boolean;
}) {
  // El saldo inicial se edita desde el formulario de la cuenta o tarjeta.
  if (transaction.type === "opening_balance") return null;

  if (transaction.type === "transfer") {
    return (
      <div className="flex justify-end gap-1">
        <TransferForm accounts={accounts} transaction={transaction} />
        <DeleteButton
          id={transaction.id}
          action={deleteTransaction}
          confirmLabel="¿Eliminar esta transferencia?"
        />
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      {/* G8 (3.0.1): comprobante. */}
      <ReceiptDialog movementId={transaction.id} hasReceipt={Boolean(transaction.receipt_path)} />
      {canShare ? (
        <Link
          href={`/procesos/compartidos/nuevo?movimiento=${transaction.id}`}
          aria-label="Compartir este gasto"
          title="Compartir este gasto"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <Users className="size-4" />
        </Link>
      ) : null}
      <TransactionForm
        type={transaction.type}
        accounts={accounts}
        cards={cards}
        debitCards={debitCards}
        categories={categories}
        categoryIcons={categoryIcons}
        fixedCardId={
          transaction.type === "card_payment"
            ? (transaction.card_id ?? undefined)
            : undefined
        }
        transaction={transaction}
      />
      <DeleteButton
        id={transaction.id}
        action={deleteTransaction}
        confirmLabel="¿Eliminar este movimiento?"
      />
    </div>
  );
}
