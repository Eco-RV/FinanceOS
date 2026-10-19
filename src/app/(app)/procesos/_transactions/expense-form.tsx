"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Banknote,
  ChevronDown,
  CreditCard as CardIcon,
  Pencil,
  Plus,
  Smartphone,
  WalletCards,
} from "lucide-react";
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
import { FormField } from "@/components/form-field";
import { useDialogForm } from "@/lib/use-dialog-form";
import { crToday, overdraftWarning, toISODate } from "@/domain";
import { formatCurrency } from "@/lib/format";
import type { CategoryIconKey } from "@/lib/category-icon-keys";
import type { Account, CreditCard, DebitCard, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveTransaction } from "./actions";
import { CategoryPicker } from "./category-picker";
import { WalletCarousel } from "./wallet-carousel";

type Currency = "CRC" | "USD";
/** Crédito · débito (2.8.0) · SINPE (2.8.0) · efectivo. */
export type ExpenseMode = "card" | "debit" | "sinpe" | "cash";
type Mode = ExpenseMode;

const BANK_TYPES = new Set(["checking", "savings"]);

const SYMBOL: Record<Currency, string> = { CRC: "₡", USD: "$" };
/** "12500,5" o "1.234,50" → "12500.5" / "1234.50": el último separador es el decimal. */
function cleanAmount(raw: string): string {
  const s = raw.replace(/[^\d.,]/g, "").replace(/,/g, ".");
  const last = s.lastIndexOf(".");
  if (last < 0) return s;
  return s.slice(0, last).replace(/\./g, "") + "." + s.slice(last + 1, last + 3);
}

/**
 * Gasto rápido (2.5.0): pensado para el día a día en el teléfono.
 * 1) Monto con botón de moneda · 2) Categoría con íconos · 3) Cómo pagaste:
 * tarjeta de crédito (carrusel tipo billetera), tarjeta de débito o SINPE
 * desde una cuenta bancaria (2.8.0), o efectivo · 4) "Más opciones": fecha y
 * nota.
 */
export function ExpenseForm({
  accounts,
  cards,
  debitCards = [],
  categories: categoryOptions,
  categoryIcons,
  transaction,
  triggerLabel,
  fab = false,
  initialMode,
}: {
  accounts: Account[];
  cards: CreditCard[];
  /** Tarjetas de débito activas (2.8.0). */
  debitCards?: DebitCard[];
  /** Modo con el que abre un gasto nuevo (p. ej. "sinpe" desde Gastos). */
  initialMode?: Mode;
  categories: string[];
  categoryIcons?: Record<string, CategoryIconKey>;
  transaction?: Transaction;
  triggerLabel?: string;
  fab?: boolean;
}) {
  const editing = Boolean(transaction);
  const today = toISODate(crToday());
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [currency, setCurrency] = useState<Currency>(
    transaction?.currency === "USD" ? "USD" : "CRC",
  );
  const amountValue = cleanAmount(amount);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveTransaction,
    editing ? "Gasto actualizado" : "Gasto registrado",
    {
      celebrate: true,
      detail: Number(amountValue) > 0 ? formatCurrency(Number(amountValue), currency) : undefined,
    },
  );

  // Efectivo: cuentas de tipo efectivo (+ la cuenta del gasto que se edita, si es otra).
  const cashAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.type === "cash" || (transaction?.account_id && a.id === transaction.account_id),
      ),
    [accounts, transaction],
  );

  const categories =
    transaction?.category && !categoryOptions.includes(transaction.category)
      ? [transaction.category, ...categoryOptions]
      : categoryOptions;

  // Cuentas bancarias (SINPE) y tarjetas de débito con su cuenta, activas.
  const bankAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => BANK_TYPES.has(a.type) || (transaction?.account_id && a.id === transaction.account_id),
      ),
    [accounts, transaction],
  );
  const debitOptions = useMemo(
    () =>
      debitCards
        .map((d) => ({ card: d, account: accounts.find((a) => a.id === d.account_id) }))
        .filter((o): o is { card: DebitCard; account: Account } => Boolean(o.account)),
    [debitCards, accounts],
  );

  const [category, setCategory] = useState(transaction?.category ?? "");
  const defaultMode = (): Mode =>
    transaction
      ? transaction.card_id
        ? "card"
        : transaction.channel === "sinpe"
          ? "sinpe"
          : transaction.debit_card_id
            ? "debit"
            : "cash"
      : (initialMode ?? (cards.length > 0 ? "card" : debitOptions.length > 0 ? "debit" : "cash"));
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [cardId, setCardId] = useState(transaction?.card_id ?? cards[0]?.id ?? "");
  const [cashId, setCashId] = useState(
    transaction?.account_id ?? cashAccounts.find((a) => a.currency === "CRC")?.id ?? cashAccounts[0]?.id ?? "",
  );
  const [bankId, setBankId] = useState(transaction?.account_id ?? "");
  const [debitId, setDebitId] = useState(transaction?.debit_card_id ?? "");
  const [more, setMore] = useState(
    Boolean(transaction && (transaction.note || transaction.occurred_on !== today)),
  );

  // Al abrir un gasto nuevo: formulario limpio y la primera tarjeta elegida.
  function onOpenChange(next: boolean) {
    if (next && !editing) {
      setAmount("");
      setCategory("");
      setMore(false);
      setCardId(cards[0]?.id ?? "");
      setMode(defaultMode());
    }
    setOpen(next);
  }

  // En efectivo la moneda la manda la cuenta: se ofrecen las de la moneda elegida.
  const cashForCurrency = cashAccounts.filter((a) => a.currency === currency);
  const cashSelected = cashForCurrency.some((a) => a.id === cashId)
    ? cashId
    : (cashForCurrency[0]?.id ?? "");

  // SINPE y débito: la moneda la manda la cuenta (se ofrecen las de la moneda elegida).
  const bankForCurrency = bankAccounts.filter((a) => a.currency === currency);
  const bankSelected = bankForCurrency.some((a) => a.id === bankId)
    ? bankId
    : (bankForCurrency[0]?.id ?? "");
  const debitForCurrency = debitOptions.filter((o) => o.account.currency === currency);
  const debitSelected =
    debitForCurrency.find((o) => o.card.id === debitId) ?? debitForCurrency[0];
  // Al editar, se conserva la tarjeta de débito aunque ya no esté en la lista.
  const keptDebit =
    !debitSelected && transaction?.debit_card_id && transaction.account_id
      ? { cardId: transaction.debit_card_id, accountId: transaction.account_id }
      : null;

  const origin =
    mode === "card"
      ? cardId
        ? `card:${cardId}`
        : ""
      : mode === "debit"
        ? debitSelected
          ? `account:${debitSelected.account.id}`
          : keptDebit
            ? `account:${keptDebit.accountId}`
            : ""
        : mode === "sinpe"
          ? bankSelected
            ? `account:${bankSelected}`
            : ""
          : cashSelected
            ? `account:${cashSelected}`
            : "";
  // C2 (advierte): la cuenta de débito/SINPE/efectivo puede quedar en negativo.
  const payingAccount =
    mode === "debit"
      ? (debitSelected?.account ?? accounts.find((a) => a.id === keptDebit?.accountId))
      : mode === "sinpe"
        ? bankForCurrency.find((a) => a.id === bankSelected)
        : mode === "cash"
          ? cashForCurrency.find((a) => a.id === cashSelected)
          : undefined;
  const overdraft = payingAccount
    ? overdraftWarning(
        Number(payingAccount.current_balance),
        Number(amountValue),
        transaction?.account_id === payingAccount.id ? Number(transaction.amount) : 0,
      )
    : null;

  const debitCardValue =
    mode === "debit" ? (debitSelected?.card.id ?? keptDebit?.cardId ?? "") : "";

  function handleSubmit(formData: FormData) {
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
              aria-label={triggerLabel ?? "Nuevo gasto"}
              title={triggerLabel ?? "Nuevo gasto"}
              className="size-14 rounded-2xl shadow-lg transition-[background-color,box-shadow,scale,filter] hover:shadow-xl hover:brightness-105 motion-safe:active:not-aria-[haspopup=menu]:scale-90 bg-expense text-expense-foreground hover:bg-expense"
            />
          ) : (
            <Button size="sm" />
          )
        }
      >
        {editing ? (
          <Pencil className="size-4" />
        ) : fab ? (
          <ArrowUp className="size-6" strokeWidth={2.5} />
        ) : (
          <>
            <Plus className="size-4" /> {triggerLabel ?? "Nuevo gasto"}
          </>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto overscroll-contain sm:max-w-xl lg:max-w-3xl lg:p-6 max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:data-open:slide-in-from-bottom-8 max-sm:data-open:zoom-in-100">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar gasto" : (triggerLabel ?? "Nuevo gasto")}</DialogTitle>
          <DialogDescription className="sr-only">
            Monto, categoría y cómo pagaste: tarjeta de crédito o débito, SINPE o efectivo.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex min-w-0 flex-col gap-5">
          <input type="hidden" name="type" value="expense" />
          {transaction ? <input type="hidden" name="id" value={transaction.id} /> : null}
          <input type="hidden" name="origin" value={origin} />
          <input type="hidden" name="amount" value={amountValue} />
          {mode === "card" ? <input type="hidden" name="currency" value={currency} /> : null}
          {mode === "sinpe" ? <input type="hidden" name="channel" value="sinpe" /> : null}
          <input type="hidden" name="debit_card_id" value={debitCardValue} />
          {!more ? (
            <input type="hidden" name="occurred_on" value={transaction?.occurred_on ?? today} />
          ) : null}
          {!more && transaction?.note ? (
            <input type="hidden" name="note" value={transaction.note} />
          ) : null}

          {/* 2.5.0: en pantallas grandes, dos columnas (qué y cuánto · cómo pagaste). */}
          <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-8">
          <div className="flex min-w-0 flex-col gap-5">
          {/* 1 · Monto con moneda */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expense-amount" className="text-sm font-medium">
              Monto
            </label>
            <div
              className={cn(
                "flex items-center gap-2 rounded-2xl border border-input bg-card px-3 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
                errors?.amount && "border-destructive ring-3 ring-destructive/20",
              )}
            >
              <span className="text-2xl font-semibold text-muted-foreground">{SYMBOL[currency]}</span>
              <input
                id="expense-amount"
                autoFocus={!editing}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                aria-invalid={Boolean(errors?.amount) || undefined}
                className="h-14 min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40"
                required
              />
              <button
                type="button"
                onClick={() => setCurrency((c) => (c === "CRC" ? "USD" : "CRC"))}
                aria-label={`Moneda: ${currency}. Cambiar`}
                className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-muted px-3 text-sm font-semibold transition-[background-color,scale] duration-150 hover:bg-accent motion-safe:active:scale-95"
              >
                {currency}
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </div>
            {errors?.amount ? <p className="text-xs text-destructive">{errors.amount}</p> : null}
          </div>

          {/* 2 · Categoría */}
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

          </div>
          <div className="flex min-w-0 flex-col gap-5">
          {/* 3 · Cómo pagaste: crédito, débito, SINPE o efectivo */}
          <div className="flex flex-col gap-2">
            <div
              role="tablist"
              aria-label="Cómo pagaste"
              className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1"
            >
              {(
                [
                  ["card", "Crédito", CardIcon],
                  ["debit", "Débito", WalletCards],
                  ["sinpe", "SINPE", Smartphone],
                  ["cash", "Efectivo", Banknote],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={cn(
                    "flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg text-xs transition-[background-color,color,box-shadow,scale] duration-200 ease-fluid motion-safe:active:scale-[0.97] sm:text-sm",
                    mode === key
                      ? "bg-card font-medium text-foreground shadow-sm dark:bg-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0 max-[360px]:hidden" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {mode === "card" ? (
              cards.length > 0 ? (
                <WalletCarousel cards={cards} value={cardId} onChange={setCardId} />
              ) : (
                <EmptyOrigin>
                  No tienes tarjetas activas.{" "}
                  <Link href="/procesos/tarjetas" className="underline">
                    Agrega una
                  </Link>
                  .
                </EmptyOrigin>
              )
            ) : mode === "debit" ? (
              debitForCurrency.length === 0 && !keptDebit ? (
                <EmptyOrigin>
                  No tienes una tarjeta de débito en {currency}.{" "}
                  <Link href="/procesos/cuentas" className="underline">
                    Agrégala en su cuenta
                  </Link>
                  .
                </EmptyOrigin>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {debitForCurrency.map(({ card, account }) => (
                    <button key={card.id} type="button" onClick={() => setDebitId(card.id)} className="text-left">
                      <PayChip
                        icon={WalletCards}
                        title={card.last_four ? `${card.name} ••${card.last_four}` : card.name}
                        detail={`${account.name} · ${formatCurrency(Number(account.current_balance), account.currency)}`}
                        selected={card.id === debitSelected?.card.id}
                      />
                    </button>
                  ))}
                </div>
              )
            ) : mode === "sinpe" ? (
              bankForCurrency.length === 0 ? (
                <EmptyOrigin>
                  No tienes una cuenta bancaria en {currency}.{" "}
                  <Link href="/procesos/cuentas" className="underline">
                    Créala en Cuentas
                  </Link>
                  .
                </EmptyOrigin>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {bankForCurrency.map((a) => (
                      <button key={a.id} type="button" onClick={() => setBankId(a.id)} className="text-left">
                        <PayChip
                          icon={Smartphone}
                          title={a.name}
                          detail={formatCurrency(Number(a.current_balance), a.currency)}
                          selected={a.id === bankSelected}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Para (opcional)"
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
                </div>
              )
            ) : cashForCurrency.length === 0 ? (
              <EmptyOrigin>
                No tienes una cuenta de efectivo en {currency}.{" "}
                <Link href="/procesos/cuentas" className="underline">
                  Créala en Cuentas
                </Link>{" "}
                (tipo Efectivo).
              </EmptyOrigin>
            ) : cashForCurrency.length === 1 ? (
              <CashChip account={cashForCurrency[0]} selected />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {cashForCurrency.map((a) => (
                  <button key={a.id} type="button" onClick={() => setCashId(a.id)} className="text-left">
                    <CashChip account={a} selected={a.id === cashSelected} />
                  </button>
                ))}
              </div>
            )}
            {overdraft != null && payingAccount ? (
              <p role="status" className="rounded-xl bg-warning/15 px-3 py-2 text-xs text-foreground">
                {payingAccount.name} quedará en{" "}
                <span className="font-medium tabular-nums">
                  {formatCurrency(overdraft, payingAccount.currency)}
                </span>
                . Puedes registrarlo igual.
              </p>
            ) : null}
            {errors?.origin ? <p className="text-xs text-destructive">{errors.origin}</p> : null}
          </div>

          {/* 4 · Más opciones: fecha y nota */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setMore((m) => !m)}
              aria-expanded={more}
              className="flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground transition-[background-color,color,scale] duration-150 hover:text-foreground motion-safe:active:scale-95"
            >
              <Plus
                className={cn(
                  "size-4 transition-transform duration-200 ease-fluid",
                  more && "rotate-45",
                )}
              />
              {more ? "Menos opciones" : "Más opciones"}
              <span className="text-xs opacity-70">fecha y nota</span>
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-fluid",
                more ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                {more ? (
                  <div className="grid grid-cols-1 gap-3 p-0.5 sm:grid-cols-2">
                    <FormField label="Fecha" htmlFor="occurred_on" error={errors?.occurred_on}>
                      <Input
                        id="occurred_on"
                        name="occurred_on"
                        type="date"
                        defaultValue={transaction?.occurred_on ?? today}
                        required
                      />
                    </FormField>
                    <FormField label="Nota (opcional)" htmlFor="note" error={errors?.note}>
                      <Input id="note" name="note" defaultValue={transaction?.note ?? ""} />
                    </FormField>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          </div>
          </div>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}

          <DialogFooter>
            <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending || !origin}>
              {pending ? "Guardando…" : editing ? "Guardar cambios" : "Registrar gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CashChip({ account, selected }: { account: Account; selected?: boolean }) {
  return (
    <PayChip
      icon={Banknote}
      title={account.name}
      detail={formatCurrency(Number(account.current_balance), account.currency)}
      selected={selected}
    />
  );
}

/** Opción de pago elegible (cuenta de efectivo, cuenta para SINPE o tarjeta de débito). */
function PayChip({
  icon: Icon,
  title,
  detail,
  selected,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl p-3 transition-[box-shadow,background-color] duration-150",
        selected
          ? "bg-success/10 ring-2 ring-success"
          : "bg-muted/50 ring-1 ring-transparent hover:bg-muted",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground tabular-nums">{detail}</p>
      </div>
    </div>
  );
}

function EmptyOrigin({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
