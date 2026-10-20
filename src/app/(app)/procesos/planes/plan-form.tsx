"use client";

import { useState } from "react";
import { BriefcaseBusiness, Pencil, Plus, Repeat, ShieldCheck } from "lucide-react";
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
import { CURRENCIES } from "@/lib/schema";
import type { CategoryIconKey } from "@/lib/category-icon-keys";
import type { Account, CreditCard, DebitCard } from "@/lib/types";
import type { Plan } from "@/application";
import { cn } from "@/lib/utils";
import { CategoryPicker } from "../_transactions/category-picker";
import { savePlanAction } from "./actions";
import { suggestFixedCategory } from "@/domain";
import { FREQUENCY_LABEL, KIND_LABEL } from "./labels";

type Kind = Plan["kind"];

const KINDS: { kind: Kind; icon: typeof Repeat; hint: string }[] = [
  { kind: "salary", icon: BriefcaseBusiness, hint: "Ingreso a una cuenta" },
  { kind: "subscription", icon: Repeat, hint: "Renta, servicios, suscripciones" },
  { kind: "insurance", icon: ShieldCheck, hint: "Cargo mensual a tarjeta de crédito o débito" },
];

type Categories = { names: string[]; icons: Record<string, CategoryIconKey> };

export function PlanFormDialog({
  plan,
  initialKind = "salary",
  accounts,
  cards,
  debitCards = [],
  incomeCategories,
  expenseCategories,
}: {
  plan?: Plan;
  initialKind?: Kind;
  accounts: Account[];
  cards: CreditCard[];
  /** Tarjetas de débito activas: un gasto fijo se puede pagar con ellas (2.8.0). */
  debitCards?: DebitCard[];
  incomeCategories: Categories;
  expenseCategories: Categories;
}) {
  const editing = Boolean(plan);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    savePlanAction,
    editing ? "Plan actualizado" : "Plan creado",
  );
  const [kind, setKind] = useState<Kind>(plan?.kind ?? initialKind);
  const [currency, setCurrency] = useState(plan?.currency ?? "CRC");
  const [payWith, setPayWith] = useState<"card" | "debit" | "account">(
    plan ? (plan.card_id ? "card" : plan.debit_card_id ? "debit" : "account") : "card",
  );
  const [category, setCategory] = useState(plan?.category ?? "");
  const [name, setName] = useState(plan?.name ?? "");

  const usesAccount = kind === "salary" || (kind === "subscription" && payWith === "account");
  // T9 (3.0.1): un seguro va a una tarjeta de crédito o de débito.
  const usesDebit = (kind === "subscription" || kind === "insurance") && payWith === "debit";
  const accountOptions = accounts.filter((a) => a.currency === currency);
  // Tarjetas de débito cuya cuenta es de la moneda del plan.
  const debitOptions = debitCards.filter((d) =>
    accountOptions.some((a) => a.id === d.account_id),
  );
  const defaultTarget = plan
    ? plan.debit_card_id
      ? `debit:${plan.debit_card_id}`
      : plan.account_id
      ? `account:${plan.account_id}`
      : plan.card_id
        ? `card:${plan.card_id}`
        : ""
    : "";
  const cats = kind === "salary" ? incomeCategories : expenseCategories;
  // Gasto fijo: mientras no elija, la categoría sigue al nombre (Alquiler → Vivienda).
  const defaultCategory =
    kind === "salary"
      ? "Salario"
      : kind === "insurance"
        ? "Seguros"
        : (suggestFixedCategory(name) ?? "Suscripciones");
  const categoryList = cats.names.includes(defaultCategory) ? cats.names : [defaultCategory, ...cats.names];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && !editing) {
          setKind(initialKind);
          setCategory("");
          setName("");
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          editing ? <Button variant="ghost" size="icon" aria-label="Editar" /> : <Button size="sm" />
        }
      >
        {editing ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" /> Nuevo plan
          </>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar ${KIND_LABEL[kind].toLowerCase()}` : "Nuevo plan"}</DialogTitle>
          <DialogDescription>
            Cada fecha se registra sola cuando llega; las que vienen se ven como programadas.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex min-w-0 flex-col gap-4">
          {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
          <input type="hidden" name="kind" value={kind} />

          {!editing ? (
            <div role="radiogroup" aria-label="Tipo de plan" className="grid grid-cols-3 gap-2">
              {KINDS.map(({ kind: k, icon: Icon, hint }) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => {
                    setKind(k);
                    setCategory("");
                    // Un seguro no se paga desde la cuenta sola (T9).
                    if (k === "insurance" && payWith === "account") setPayWith("card");
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl p-3 text-center text-sm transition-[background-color,box-shadow,scale] duration-150 ease-fluid motion-safe:active:scale-[0.97]",
                    kind === k
                      ? "bg-primary/[0.06] font-medium ring-2 ring-primary dark:bg-primary/10"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {KIND_LABEL[k]}
                  <span className="text-[11px] leading-tight font-normal text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
          ) : null}

          <FormField label="Nombre" htmlFor="plan-name" error={errors?.name}>
            <Input
              id="plan-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder={
                kind === "salary" ? "Ej. Salario empresa" : kind === "insurance" ? "Ej. Seguro de vida" : "Ej. Alquiler, Luz, Internet, Netflix"
              }
              required
            />
          </FormField>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <FormField label="Monto" htmlFor="plan-amount" error={errors?.amount}>
              <Input
                id="plan-amount"
                name="amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={plan?.amount ?? ""}
                required
              />
            </FormField>
            <FormField label="Moneda" htmlFor="plan-currency" error={errors?.currency}>
              <Select
                id="plan-currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Plan["currency"])}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {kind === "salary" ? (
            <FormField label="Cada cuánto" htmlFor="plan-frequency" error={errors?.frequency}>
              <Select id="plan-frequency" name="frequency" defaultValue={plan?.frequency ?? "semimonthly"}>
                {(Object.keys(FREQUENCY_LABEL) as Plan["frequency"][]).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABEL[f]}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <input type="hidden" name="frequency" value="monthly" />
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={kind === "salary" ? "Primer pago" : "Primer cargo"}
              htmlFor="plan-start"
              error={errors?.starts_on}
              hint={kind === "salary" ? undefined : "Se repite ese día cada mes."}
            >
              <Input
                id="plan-start"
                name="starts_on"
                type="date"
                defaultValue={plan?.starts_on ?? toISODate(crToday())}
                required
              />
            </FormField>
            <FormField label="Hasta (opcional)" htmlFor="plan-end" error={errors?.ends_on}>
              <Input id="plan-end" name="ends_on" type="date" defaultValue={plan?.ends_on ?? ""} />
            </FormField>
          </div>

          {kind === "subscription" || kind === "insurance" ? (
            <div
              role="tablist"
              aria-label="Cómo se paga"
              className={cn("grid gap-1 rounded-xl bg-muted p-1", kind === "insurance" ? "grid-cols-2" : "grid-cols-3")}
            >
              {(
                (kind === "insurance"
                  ? [
                      ["card", "Tarjeta de crédito"],
                      ["debit", "Tarjeta de débito"],
                    ]
                  : [
                      ["card", "Crédito"],
                      ["debit", "Tarjeta de débito"],
                      ["account", "Cuenta"],
                    ]) as [typeof payWith, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={payWith === k}
                  onClick={() => setPayWith(k)}
                  className={cn(
                    "h-8 min-w-0 truncate rounded-lg px-1 text-xs transition-[background-color,color,box-shadow] duration-200 sm:text-sm",
                    payWith === k
                      ? "bg-card font-medium text-foreground shadow-sm dark:bg-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <FormField
            label={
              kind === "salary"
                ? "Cuenta donde entra"
                : usesAccount
                  ? "Cuenta que paga"
                  : usesDebit
                    ? "Tarjeta de débito"
                    : "Tarjeta"
            }
            hint={kind === "subscription" ? "Si el monto varía (luz, agua), edita el movimiento cuando llegue." : undefined}
            htmlFor="plan-target"
            error={errors?.target}
          >
            <Select key={`${kind}:${payWith}:${currency}`} id="plan-target" name="target" defaultValue={defaultTarget}>
              <option value="">Elige…</option>
              {usesAccount
                ? accountOptions.map((a) => (
                    <option key={a.id} value={`account:${a.id}`}>
                      {a.name}
                    </option>
                  ))
                : usesDebit
                  ? debitOptions.map((d) => (
                      <option key={d.id} value={`debit:${d.id}`}>
                        {d.name}
                        {d.last_four ? ` •••• ${d.last_four}` : ""} ·{" "}
                        {accounts.find((a) => a.id === d.account_id)?.name}
                      </option>
                    ))
                : cards.map((c) => (
                    <option key={c.id} value={`card:${c.id}`}>
                      {c.name}
                      {c.last_four ? ` •••• ${c.last_four}` : ""}
                    </option>
                  ))}
            </Select>
            {usesAccount && accountOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tienes cuentas en {currency}.</p>
            ) : null}
            {usesDebit && debitOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tienes tarjetas de débito en {currency}. Agrégala desde su cuenta en Cuentas.
              </p>
            ) : usesDebit ? (
              <p className="text-xs text-muted-foreground">El cargo sale del saldo de su cuenta.</p>
            ) : null}
          </FormField>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Categoría</p>
            <CategoryPicker
              categories={categoryList}
              icons={cats.icons}
              value={category || (plan ? "" : defaultCategory)}
              onChange={setCategory}
              error={errors?.category}
            />
          </div>

          {kind !== "insurance" ? (
            <label className="flex cursor-pointer items-start gap-2 text-sm select-none">
              <input
                type="checkbox"
                name="variable"
                defaultChecked={Boolean(plan?.variable)}
                className="mt-0.5 size-4 accent-foreground"
              />
              <span>
                El monto varía
                <span className="block text-xs text-muted-foreground">
                  {kind === "salary"
                    ? "Salario variable: cada pago entra con este monto estimado y lo confirmas en Planes."
                    : "Luz, agua…: cada cobro entra con este monto estimado y lo confirmas en Planes."}
                </span>
              </span>
            </label>
          ) : null}

          <FormField label="Nota (opcional)" htmlFor="plan-note" error={errors?.note}>
            <Input id="plan-note" name="note" defaultValue={plan?.note ?? ""} maxLength={200} />
          </FormField>

          {message ? <p className="text-sm text-destructive">{message}</p> : null}
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
