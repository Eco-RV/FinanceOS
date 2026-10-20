"use client";

import { useState } from "react";
import { ArrowDown, Pencil, Plus } from "lucide-react";
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
import type { CategoryIconKey } from "@/lib/category-icon-keys";
import { useDialogForm } from "@/lib/use-dialog-form";
import { readLastUsed, rememberLastUsed } from "@/lib/last-used";
import { crToday, overdraftWarning, overpaymentWarning, toISODate } from "@/domain";
import { originValue } from "@/lib/transactions";
import { CURRENCIES } from "@/lib/schema";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Account, CreditCard, DebitCard, Transaction, TransactionType } from "@/lib/types";
import { saveTransaction } from "./actions";
import { CategoryPicker } from "./category-picker";
import { ExpenseForm } from "./expense-form";

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
  /** Saldo a pagar de la tarjeta por moneda (botón "Usar saldo total"). */
  fixedCardBalance?: number;
  fixedCardBalances?: Partial<Record<"CRC" | "USD", number>>;
  /** Deuda total de la tarjeta por moneda (M4: avisar si el abono la supera). */
  cardDebts?: Partial<Record<"CRC" | "USD", number>>;
  /** Último tipo de cambio (M5: abono en otra moneda, 2.8.0). */
  exchangeRate?: { usd_crc: number; rate_on: string } | null;
  /** Tarjetas de débito activas para el gasto rápido (2.8.0). */
  debitCards?: DebitCard[];
  transaction?: Transaction;
  triggerLabel?: string;
  /**
   * Botón del acceso rápido global (3.0.1: lo posiciona el layout; ingreso =
   * flecha abajo en verde). Solo para gasto e ingreso.
   */
  fab?: boolean;
  /** Gasto por SINPE Móvil: abre el gasto rápido en la pestaña SINPE. */
  sinpe?: boolean;
  /** Nombre de categoría (minúsculas) → ícono (2.5.0). */
  categoryIcons?: Record<string, CategoryIconKey>;
  /** U9 (3.0.1): moneda con la que abre un gasto nuevo (moneda base). */
  defaultCurrency?: "CRC" | "USD";
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

/**
 * Registrar o editar un movimiento. Todo gasto (crédito, débito, SINPE o
 * efectivo; SINPE y débito desde 2.8.0) usa el formulario rápido
 * `ExpenseForm`; ingresos y pagos de tarjeta siguen con este.
 */
export function TransactionForm(props: Props) {
  if (props.type === "expense") {
    return (
      <ExpenseForm
        accounts={props.accounts}
        cards={props.cards ?? []}
        debitCards={props.debitCards}
        initialMode={props.sinpe ? "sinpe" : undefined}
        categories={props.categories ?? []}
        categoryIcons={props.categoryIcons}
        transaction={props.transaction}
        triggerLabel={props.triggerLabel}
        fab={props.fab}
        defaultCurrency={props.defaultCurrency}
      />
    );
  }
  return <MovementForm {...props} />;
}

function MovementForm({
  type,
  accounts,
  cards = [],
  categories: categoryOptions = [],
  fixedCardId,
  fixedCardBalance,
  fixedCardBalances,
  cardDebts,
  exchangeRate,
  transaction,
  triggerLabel,
  fab = false,
  categoryIcons,
}: Props) {
  const editing = Boolean(transaction);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveTransaction,
    editing ? "Movimiento actualizado" : SUCCESS[type],
  );

  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : "",
  );
  const [category, setCategory] = useState(transaction?.category ?? "");

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

  // T1: un cargo con tarjeta puede ser en CRC o USD; en una cuenta manda su moneda.
  const [origin, setOrigin] = useState(defaultOrigin);
  const originIsCard = type === "expense" && origin.startsWith("card:");
  const originCard = originIsCard
    ? cards.find((c) => `card:${c.id}` === origin)
    : undefined;

  // M5 (2.8.0): el abono baja el saldo de la tarjeta en la moneda elegida; si
  // la cuenta es de otra moneda, paga el equivalente con el tipo de cambio.
  const originAccount = accounts.find((a) => `account:${a.id}` === origin) ??
    (!showOrigin ? accounts[0] : undefined);
  const accountCurrency = originAccount?.currency === "USD" ? "USD" : "CRC";
  const [paymentCurrency, setPaymentCurrency] = useState<"" | "CRC" | "USD">(
    transaction?.type === "card_payment" && transaction.currency !== originAccount?.currency
      ? (transaction.currency as "CRC" | "USD")
      : "",
  );
  const payIn = paymentCurrency || accountCurrency;
  const converts = type === "card_payment" && payIn !== accountCurrency;
  const amountNumber = Number(amount);
  const converted =
    converts && exchangeRate && amountNumber > 0
      ? payIn === "USD"
        ? Math.round(amountNumber * exchangeRate.usd_crc * 100) / 100
        : Math.round((amountNumber / exchangeRate.usd_crc) * 100) / 100
      : null;
  const totalToPay =
    type === "card_payment"
      ? (fixedCardBalances?.[payIn] ?? (payIn === accountCurrency ? fixedCardBalance : undefined))
      : undefined;

  // M4 (advierte): un abono mayor que la deuda deja saldo a favor.
  const appliedHere =
    transaction?.type === "card_payment" && transaction.currency === payIn ? Number(transaction.amount) : 0;
  const overpaid =
    type === "card_payment" && typeof cardDebts?.[payIn] === "number"
      ? overpaymentWarning(Math.max(0, cardDebts[payIn]!), amountNumber, appliedHere)
      : null;
  // C2 (advierte): un gasto desde una cuenta puede dejarla en negativo.
  const overdraft =
    type === "expense" && originAccount
      ? overdraftWarning(
          Number(originAccount.current_balance),
          amountNumber,
          transaction?.account_id === originAccount.id ? Number(transaction.amount) : 0,
        )
      : null;

  const canPayTotal = type === "card_payment" && typeof totalToPay === "number" && totalToPay > 0;

  // 3.0.1 · ley de Parkinson: un ingreso nuevo propone la cuenta y la
  // categoría de la última vez.
  function onOpenChange(next: boolean) {
    if (next && !editing && type === "income") {
      const lastAccount = readLastUsed("ingreso:cuenta");
      if (lastAccount && accounts.some((a) => a.id === lastAccount)) setOrigin(`account:${lastAccount}`);
      else if (!origin && accounts.length === 1) setOrigin(`account:${accounts[0].id}`);
      const lastCategory = readLastUsed("ingreso:categoria");
      if (!category && lastCategory && categories.includes(lastCategory)) setCategory(lastCategory);
    }
    setOpen(next);
  }

  function handleSubmit(formData: FormData) {
    if (!editing && type === "income") {
      rememberLastUsed("ingreso:cuenta", origin.startsWith("account:") ? origin.slice(8) : null);
      rememberLastUsed("ingreso:categoria", category);
    }
    submit(formData);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          editing ? (
            <Button variant="ghost" size="icon" aria-label="Editar" />
          ) : fab ? (
            <Button
              size="icon-lg"
              aria-label={triggerLabel ?? NEW_LABEL[type]}
              title={triggerLabel ?? NEW_LABEL[type]}
              className="size-14 rounded-2xl shadow-lg transition-[background-color,box-shadow,scale,filter] hover:shadow-xl hover:brightness-105 motion-safe:active:not-aria-[haspopup=menu]:scale-90 bg-income text-income-foreground hover:bg-income"
            />
          ) : (
            <Button size="sm" />
          )
        }
      >
        {editing ? (
          <Pencil className="size-4" />
        ) : fab ? (
          <ArrowDown className="size-6" strokeWidth={2.5} />
        ) : (
          <>
            <Plus className="size-4" /> {triggerLabel ?? NEW_LABEL[type]}
          </>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Editar ${DIALOG_TITLE[type]}` : (triggerLabel ?? NEW_LABEL[type])}
          </DialogTitle>
          <DialogDescription>
            {type === "card_payment"
              ? "Baja el saldo de la tarjeta y de la cuenta origen."
              : type === "income"
                ? "Suma el monto al saldo de la cuenta."
                : "Resta el monto de la cuenta o lo carga a la tarjeta."}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="type" value={type} />
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
              onClick={() => setAmount(String(totalToPay))}
            >
              Usar saldo total de la tarjeta ({formatCurrency(totalToPay!, payIn)})
            </Button>
          ) : null}

          {overpaid != null ? (
            <p role="status" className="rounded-xl bg-warning/15 px-3 py-2 text-xs text-foreground">
              Abonas más que la deuda: quedará un saldo a favor de{" "}
              <span className="font-medium tabular-nums">{formatCurrency(overpaid, payIn)}</span>.
              Puedes registrarlo igual.
            </p>
          ) : null}
          {overdraft != null && originAccount ? (
            <p role="status" className="rounded-xl bg-warning/15 px-3 py-2 text-xs text-foreground">
              {originAccount.name} quedará en{" "}
              <span className="font-medium tabular-nums">
                {formatCurrency(overdraft, originAccount.currency)}
              </span>
              . Puedes registrarlo igual.
            </p>
          ) : null}

          {type === "card_payment" ? (
            <div className="flex flex-col gap-2">
              <FormField label="Saldo de la tarjeta que abonas" htmlFor="currency">
                <Select
                  id="currency"
                  name="currency"
                  value={payIn}
                  onChange={(e) => setPaymentCurrency(e.target.value as "CRC" | "USD")}
                >
                  <option value="CRC">Colones (₡)</option>
                  <option value="USD">Dólares ($)</option>
                </Select>
              </FormField>
              {converts ? (
                exchangeRate ? (
                  <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    El monto va en {payIn === "USD" ? "dólares" : "colones"}.{" "}
                    {converted != null ? (
                      <>
                        Sale de la cuenta{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {formatCurrency(converted, accountCurrency)}
                        </span>{" "}
                      </>
                    ) : (
                      "La cuenta paga el equivalente "
                    )}
                    con $1 = {formatCurrency(exchangeRate.usd_crc, "CRC")} (
                    {formatDate(exchangeRate.rate_on)}).
                  </p>
                ) : (
                  <p className="rounded-xl bg-warning/15 px-3 py-2 text-xs text-foreground">
                    Para abonar en otra moneda registra el tipo de cambio en Ajustes → Tipo de
                    cambio.
                  </p>
                )
              ) : null}
            </div>
          ) : null}

          {type !== "card_payment" ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">Categoría</p>
              <CategoryPicker
                categories={categories}
                icons={categoryIcons}
                value={category}
                onChange={setCategory}
                error={errors?.category}
              />
            </div>
          ) : null}

          {showOrigin ? (
            <FormField
              label={type === "expense" ? "Origen (cuenta o tarjeta)" : type === "income" ? "Cuenta que recibe" : "Cuenta origen"}
              htmlFor="origin"
              error={errors?.origin}
            >
              <Select
                id="origin"
                name="origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              >
                <option value="">Elegí…</option>
                {type === "expense" ? (
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

          {originIsCard ? (
            <FormField label="Moneda del cargo" htmlFor="currency" error={errors?.currency}>
              <Select
                key={origin}
                id="currency"
                name="currency"
                defaultValue={
                  transaction?.card_id && `card:${transaction.card_id}` === origin
                    ? transaction.currency
                    : (originCard?.currency ?? "CRC")
                }
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
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
