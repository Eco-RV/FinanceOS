"use client";

import { ArrowLeftRight, Pencil } from "lucide-react";
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
import type { Account, Transaction } from "@/lib/types";
import { saveTransfer } from "./actions";

/** Transferencia entre cuentas propias de la misma moneda (M2). No es gasto. */
export function TransferForm({
  accounts,
  transaction,
}: {
  accounts: Account[];
  transaction?: Transaction;
}) {
  const editing = Boolean(transaction);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveTransfer,
    editing ? "Transferencia actualizada" : "Transferencia registrada",
  );

  const options = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name} · {a.currency}
    </option>
  ));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          editing ? (
            <Button variant="ghost" size="icon" aria-label="Editar" />
          ) : (
            <Button size="sm" />
          )
        }
      >
        {editing ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <ArrowLeftRight className="size-4" /> Nueva transferencia
          </>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar transferencia" : "Nueva transferencia"}</DialogTitle>
          <DialogDescription>
            Mueve dinero entre tus cuentas de la misma moneda. No cuenta como gasto.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          {transaction ? <input type="hidden" name="id" value={transaction.id} /> : null}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Desde" htmlFor="from_account_id" error={errors?.from_account_id}>
              <Select
                id="from_account_id"
                name="from_account_id"
                defaultValue={transaction?.account_id ?? ""}
              >
                <option value="">Elegí…</option>
                {options}
              </Select>
            </FormField>
            <FormField label="Hacia" htmlFor="to_account_id" error={errors?.to_account_id}>
              <Select
                id="to_account_id"
                name="to_account_id"
                defaultValue={transaction?.to_account_id ?? ""}
              >
                <option value="">Elegí…</option>
                {options}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Monto" htmlFor="amount" error={errors?.amount}>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={transaction?.amount ?? ""}
                required
              />
            </FormField>
            <FormField label="Fecha" htmlFor="occurred_on" error={errors?.occurred_on}>
              <Input
                id="occurred_on"
                name="occurred_on"
                type="date"
                defaultValue={transaction?.occurred_on ?? toISODate(crToday())}
                required
              />
            </FormField>
          </div>

          <FormField label="Nota (opcional)" htmlFor="note" error={errors?.note}>
            <Input id="note" name="note" defaultValue={transaction?.note ?? ""} />
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
