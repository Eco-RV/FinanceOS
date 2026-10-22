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
import {
  crToday,
  CURRENCIES,
  isCurrency,
  loanSchedule,
  toISODate,
  type Currency,
} from "@/domain";
import { formatCurrency } from "@/lib/format";
import type { Account, Loan } from "@/lib/types";
import { createLoan, renameLoan } from "./actions";
import { keepOnError } from "@/lib/keep-on-error";

type AccountOption = Pick<Account, "id" | "name" | "currency">;

/** Cuota y total de intereses con los mismos cálculos del dominio (F5). */
function previewOf(principal: string, rate: string, months: string, currency: Currency) {
  try {
    const s = loanSchedule({
      principal: Number(principal),
      annualRatePercent: Number(rate),
      months: Number(months),
      firstPaymentOn: toISODate(crToday()),
      currency,
    });
    return { payment: s.payment, interest: s.totalInterest };
  } catch {
    return null;
  }
}

export function LoanFormDialog({ accounts }: { accounts: AccountOption[] }) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    createLoan,
    "Préstamo creado",
  );
  const [currency, setCurrency] = useState<Currency>("CRC");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [months, setMonths] = useState("");
  const [disburseTo, setDisburseTo] = useState("");
  const preview = previewOf(principal, rate, months, currency);
  const sameCurrency = accounts.filter((a) => a.currency === currency);
  const today = toISODate(crToday());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nuevo préstamo
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo préstamo</DialogTitle>
          <DialogDescription>
            Cuota fija (sistema francés). El calendario se calcula con estos datos;
            cada cuota se registra como gasto cuando la pagás.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nombre" htmlFor="name" error={errors?.name}>
              <Input id="name" name="name" placeholder="Carro, vivienda…" required />
            </FormField>
            <FormField label="Banco (opcional)" htmlFor="lender" error={errors?.lender}>
              <Input id="lender" name="lender" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Moneda" htmlFor="currency" error={errors?.currency}>
              <Select
                id="currency"
                name="currency"
                value={currency}
                onChange={(e) => {
                  if (isCurrency(e.target.value)) setCurrency(e.target.value);
                  setDisburseTo("");
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Monto (capital)" htmlFor="principal" error={errors?.principal}>
              <Input
                id="principal"
                name="principal"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tasa anual (%)" htmlFor="annual_rate" error={errors?.annual_rate}>
              <Input
                id="annual_rate"
                name="annual_rate"
                type="number"
                step="0.0001"
                min={0}
                max={100}
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Meses" htmlFor="months" error={errors?.months}>
              <Input
                id="months"
                name="months"
                type="number"
                min={1}
                max={480}
                step={1}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                required
              />
            </FormField>
          </div>

          {preview ? (
            <p className="text-xs text-muted-foreground">
              Cuota fija: {formatCurrency(preview.payment, currency)} · intereses en
              total: {formatCurrency(preview.interest, currency)}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Primera cuota"
              htmlFor="first_payment_on"
              error={errors?.first_payment_on}
            >
              <Input
                id="first_payment_on"
                name="first_payment_on"
                type="date"
                defaultValue={today}
                required
              />
            </FormField>
            <FormField
              label="Se paga desde"
              htmlFor="account_id"
              error={errors?.account_id}
              hint="Sugerida al pagar"
            >
              <Select id="account_id" name="account_id" defaultValue="" key={currency}>
                <option value="">—</option>
                {sameCurrency.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Desembolso"
              htmlFor="disbursement_account_id"
              error={errors?.disbursement_account_id}
              hint="Ingreso por el monto del préstamo"
            >
              <Select
                id="disbursement_account_id"
                name="disbursement_account_id"
                value={disburseTo}
                onChange={(e) => setDisburseTo(e.target.value)}
              >
                <option value="">No registrar</option>
                {sameCurrency.map((a) => (
                  <option key={a.id} value={a.id}>
                    Depositado en {a.name}
                  </option>
                ))}
              </Select>
            </FormField>
            {disburseTo ? (
              <FormField
                label="Fecha del desembolso"
                htmlFor="disbursement_on"
                error={errors?.disbursement_on}
              >
                <Input
                  id="disbursement_on"
                  name="disbursement_on"
                  type="date"
                  defaultValue={today}
                  required
                />
              </FormField>
            ) : null}
          </div>

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

/** Editar nombre, banco y cuenta sugerida. Los términos no cambian. */
export function LoanRenameDialog({
  loan,
  accounts,
}: {
  loan: Pick<Loan, "id" | "name" | "lender" | "account_id" | "currency">;
  accounts: AccountOption[];
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    renameLoan,
    "Préstamo actualizado",
  );
  const sameCurrency = accounts.filter((a) => a.currency === loan.currency);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Editar" title="Editar" />}>
        <Pencil className="size-4" />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar préstamo</DialogTitle>
          <DialogDescription>
            El monto, la tasa, el plazo y las fechas no se editan: definen el
            calendario de cuotas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={loan.id} />
          <FormField label="Nombre" htmlFor="name" error={errors?.name}>
            <Input id="name" name="name" defaultValue={loan.name} required />
          </FormField>
          <FormField label="Banco (opcional)" htmlFor="lender" error={errors?.lender}>
            <Input id="lender" name="lender" defaultValue={loan.lender ?? ""} />
          </FormField>
          <FormField label="Se paga desde" htmlFor="account_id" error={errors?.account_id}>
            <Select id="account_id" name="account_id" defaultValue={loan.account_id ?? ""}>
              <option value="">—</option>
              {sameCurrency.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
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
