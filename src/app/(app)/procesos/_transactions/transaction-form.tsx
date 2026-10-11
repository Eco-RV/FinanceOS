"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Select } from "@/components/form-field";
import { useDialogForm } from "@/lib/use-dialog-form";
import { crToday, toISODate } from "@/domain";
import { originValue } from "@/lib/transactions";
import type { Account, CreditCard, Transaction, TransactionType } from "@/lib/types";
import { saveTransaction } from "./actions";

/**
 * Tipos que se registran con este formulario. El saldo inicial va en el de
 * cuenta/tarjeta y la transferencia tiene su propio formulario.
 */
export type FormTransactionType = Exclude<TransactionType, "opening_balance" | "transfer">;

type Props = {
  type: FormTransactionType;
  accounts: Account[];
  cards?: CreditCard[];
  /** Categorías configuradas para gastos/ingresos (no aplica a card_payment). */
  categories?: string[];
  fixedCardId?: string;
  fixedCardBalance?: number;
  transaction?: Transaction;
  triggerLabel?: string;
  /** Botón circular fijo (para el acceso rápido global) en vez del botón inline. */
  fab?: boolean;
  /** Gasto por SINPE Móvil: solo desde cuentas, con destinatario y teléfono. */
  sinpe?: boolean;
};

const NEW_LABEL: Record<FormTransactionType, string> = {
  expense: "Nuevo gasto",
  income: "Nuevo ingreso",
  card_payment: "Registrar pago / abono",
};

const SUCCESS: Record<FormTransactionType, string> = {
  expense: "Gasto registrado",
  income: "Ingreso registrado",
  card_payment: "Pago registrado",
};

const DIALOG_TITLE: Record<FormTransactionType, string> = {
  expense: "gasto",
  income: "ingreso",
  card_payment: "pago",
};

export function TransactionForm({
  type,
  accounts,
  cards = [],
  categories: categoryOptions = [],
  fixedCardId,
  fixedCardBalance,
  transaction,
  triggerLabel,
  fab = false,
  sinpe: sinpeProp = false,
}: Props) {
  const editing = Boolean(transaction);
  const sinpe = sinpeProp || transaction?.channel === "sinpe";
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveTransaction,
    editing ? "Movimiento actualizado" : sinpe ? "SINPE registrado" : SUCCESS[type],
  );

  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : "",
  );

  const categories =
    transaction?.category && !categoryOptions.includes(transaction.category)
      ? [transaction.category, ...categoryOptions]
      : categoryOptions;

  const cardId = fixedCardId ?? transaction?.card_id ?? "";
  const showOrigin = type !== "card_payment" || accounts.length > 1;
  const defaultOrigin = transaction
    ? originValue(transaction)
    : type === "card_payment" && accounts.length === 1
      ? `account:${accounts[0].id}`
      : "";

  const canPayTotal =
    type === "card_payment" &&
    typeof fixedCardBalance === "number" &&
    fixedCardBalance > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          editing ? (
            <Button variant="ghost" size="icon" aria-label="Editar" />
          ) : fab ? (
            <Button
              size="icon-lg"
              aria-label={triggerLabel ?? NEW_LABEL[type]}
              className="fixed right-4 bottom-20 z-30 rounded-full shadow-lg sm:right-6 sm:bottom-6"
            />
          ) : (
            <Button size="sm" />
          )
        }
      >
        {editing ? (
          <Pencil className="size-4" />
        ) : fab ? (
          <Plus className="size-5" />
        ) : (
          <>
            <Plus className="size-4" /> {triggerLabel ?? NEW_LABEL[type]}
          </>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing
              ? `Editar ${sinpe ? "SINPE" : DIALOG_TITLE[type]}`
              : triggerLabel ?? (sinpe ? "Nuevo SINPE" : NEW_LABEL[type])}
          </DialogTitle>
          <DialogDescription>
            {sinpe
              ? "Pago por SINPE Móvil desde una cuenta. Cuenta como gasto."
              : type === "card_payment"
              ? "Baja el saldo de la tarjeta y de la cuenta origen."
              : type === "income"
                ? "Suma el monto al saldo de la cuenta."
                : "Resta el monto de la cuenta o lo carga a la tarjeta."}
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="type" value={type} />
          {sinpe ? <input type="hidden" name="channel" value="sinpe" /> : null}
          {transaction ? (
            <input type="hidden" name="id" value={transaction.id} />
          ) : null}
          {type === "card_payment" ? (
            <input type="hidden" name="card_id" value={cardId} />
          ) : null}
          {!showOrigin && type === "card_payment" && accounts[0] ? (
            <input type="hidden" name="origin" value={`account:${accounts[0].id}`} />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Monto" htmlFor="amount" error={errors?.amount}>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </FormField>
            <FormField
              label="Fecha"
              htmlFor="occurred_on"
              error={errors?.occurred_on}
            >
              <Input
                id="occurred_on"
                name="occurred_on"
                type="date"
                defaultValue={transaction?.occurred_on ?? toISODate(crToday())}
                required
              />
            </FormField>
          </div>

          {canPayTotal ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setAmount(String(fixedCardBalance))}
            >
              Usar saldo total de la tarjeta
            </Button>
          ) : null}

          {type !== "card_payment" ? (
            <FormField
              label="Categoría"
              htmlFor="category"
              error={errors?.category}
            >
              <Select
                id="category"
                name="category"
                defaultValue={transaction?.category ?? ""}
              >
                <option value="">Elegí una categoría…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          {showOrigin ? (
            <FormField
              label={
                type === "expense" && !sinpe ? "Origen (cuenta o tarjeta)" : "Cuenta origen"
              }
              htmlFor="origin"
              error={errors?.origin}
            >
              <Select id="origin" name="origin" defaultValue={defaultOrigin}>
                <option value="">Elegí…</option>
                {type === "expense" && !sinpe ? (
                  <>
                    <optgroup label="Cuentas">
                      {accounts.map((a) => (
                        <option key={a.id} value={`account:${a.id}`}>
                          {a.name} · {a.currency}
                        </option>
                      ))}
                    </optgroup>
                    {cards.length > 0 ? (
                      <optgroup label="Tarjetas">
                        {cards.map((c) => (
                          <option key={c.id} value={`card:${c.id}`}>
                            {c.name} · {c.currency}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </>
                ) : (
                  accounts.map((a) => (
                    <option key={a.id} value={`account:${a.id}`}>
                      {a.name} · {a.currency}
                    </option>
                  ))
                )}
              </Select>
            </FormField>
          ) : null}

          {sinpe ? (
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Destinatario (opcional)"
                htmlFor="counterparty_name"
                error={errors?.counterparty_name}
              >
                <Input
                  id="counterparty_name"
                  name="counterparty_name"
                  maxLength={80}
                  defaultValue={transaction?.counterparty_name ?? ""}
                />
              </FormField>
              <FormField
                label="Teléfono (opcional)"
                htmlFor="counterparty_phone"
                error={errors?.counterparty_phone}
              >
                <Input
                  id="counterparty_phone"
                  name="counterparty_phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="8888-8888"
                  defaultValue={transaction?.counterparty_phone ?? ""}
                />
              </FormField>
            </div>
          ) : null}

          <FormField label="Nota (opcional)" htmlFor="note" error={errors?.note}>
            <Input id="note" name="note" defaultValue={transaction?.note ?? ""} />
          </FormField>

          {errors?.card_id ? (
            <p className="text-sm text-destructive">{errors.card_id}</p>
          ) : null}
          {message ? (
            <p className="text-sm text-destructive">{message}</p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
