"use client";

import { HandCoins } from "lucide-react";
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
import { formatCurrency } from "@/lib/format";
import type { Account } from "@/lib/types";
import { saveTransfer } from "../_transactions/actions";
import { keepOnError } from "@/lib/keep-on-error";

/**
 * Aporte a una meta (2.7.0): una transferencia desde otra cuenta propia de la
 * misma moneda hacia la cuenta de la meta (M2). No es gasto.
 */
export function ContributionForm({
  goalName,
  account,
  sources,
  suggested,
}: {
  goalName: string;
  account: Account;
  /** Cuentas activas de la misma moneda, sin la de la meta. */
  sources: Account[];
  /** Aporte mensual sugerido para llegar a tiempo. */
  suggested: number | null;
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveTransfer,
    "Aporte registrado",
    { celebrate: true },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" disabled={sources.length === 0} />}>
        <HandCoins className="size-4" /> Aportar
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Aportar a {goalName}</DialogTitle>
          <DialogDescription>
            Transferencia a {account.name}. No cuenta como gasto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          <input type="hidden" name="to_account_id" value={account.id} />
          <input type="hidden" name="note" value={`Aporte a ${goalName}`.slice(0, 200)} />
          <FormField label="Desde" htmlFor="from_account_id" error={errors?.from_account_id}>
            <Select id="from_account_id" name="from_account_id" defaultValue={sources[0]?.id ?? ""}>
              {sources.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {formatCurrency(Number(a.current_balance), a.currency)}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Monto"
              htmlFor="aporte-amount"
              error={errors?.amount}
              hint={suggested ? `Sugerido: ${formatCurrency(suggested, account.currency)}` : undefined}
            >
              <Input
                id="aporte-amount"
                name="amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={suggested ?? ""}
                required
              />
            </FormField>
            <FormField label="Fecha" htmlFor="aporte-date" error={errors?.occurred_on}>
              <Input
                id="aporte-date"
                name="occurred_on"
                type="date"
                defaultValue={toISODate(crToday())}
                required
              />
            </FormField>
          </div>
          {errors?.to_account_id ? <p className="text-sm text-destructive">{errors.to_account_id}</p> : null}
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Aportar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
