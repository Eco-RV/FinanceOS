"use client";

import { DeleteButton } from "@/components/delete-button";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import type { CategoryIconKey } from "@/lib/category-icon-keys";
import { TransactionForm } from "./transaction-form";
import { TransferForm } from "./transfer-form";
import { deleteTransaction } from "./actions";

export function TransactionRowActions({
  transaction,
  accounts,
  cards,
  categories,
  categoryIcons,
}: {
  transaction: Transaction;
  accounts: Account[];
  cards: CreditCard[];
  categories?: string[];
  categoryIcons?: Record<string, CategoryIconKey>;
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
      <TransactionForm
        type={transaction.type}
        accounts={accounts}
        cards={cards}
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
