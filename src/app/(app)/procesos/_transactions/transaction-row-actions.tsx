"use client";

import { DeleteButton } from "@/components/delete-button";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import { TransactionForm } from "./transaction-form";
import { deleteTransaction } from "./actions";

export function TransactionRowActions({
  transaction,
  accounts,
  cards,
  categories,
}: {
  transaction: Transaction;
  accounts: Account[];
  cards: CreditCard[];
  categories?: string[];
}) {
  return (
    <div className="flex justify-end gap-1">
      <TransactionForm
        type={transaction.type}
        accounts={accounts}
        cards={cards}
        categories={categories}
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
