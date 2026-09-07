"use client";

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
import { ACCOUNT_TYPES, CURRENCIES } from "@/lib/schema";
import { useDialogForm } from "@/lib/use-dialog-form";
import type { Account } from "@/lib/types";
import { saveAccount } from "./actions";

const TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  checking: "Débito",
  savings: "Ahorro",
  cash: "Efectivo",
};

export function AccountFormDialog({ account }: { account?: Account }) {
  const editing = Boolean(account);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveAccount,
    editing ? "Cuenta actualizada" : "Cuenta agregada",
  );

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
            <Plus className="size-4" /> Nueva cuenta
          </>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar cuenta" : "Nueva cuenta"}
          </DialogTitle>
          <DialogDescription>
            Registra el saldo actual de la cuenta.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          {account ? (
            <input type="hidden" name="id" value={account.id} />
          ) : null}

          <FormField label="Nombre" htmlFor="name" error={errors?.name}>
            <Input
              id="name"
              name="name"
              defaultValue={account?.name}
              placeholder="Ej. BBVA Nómina"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo" htmlFor="type">
              <Select
                id="type"
                name="type"
                defaultValue={account?.type ?? "checking"}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Moneda" htmlFor="currency">
              <Select
                id="currency"
                name="currency"
                defaultValue={account?.currency ?? "CRC"}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField
            label="Institución (opcional)"
            htmlFor="institution"
            error={errors?.institution}
          >
            <Input
              id="institution"
              name="institution"
              defaultValue={account?.institution ?? ""}
            />
          </FormField>

          <FormField
            label="Saldo actual"
            htmlFor="current_balance"
            error={errors?.current_balance}
          >
            <Input
              id="current_balance"
              name="current_balance"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue={account?.current_balance ?? 0}
              required
            />
          </FormField>

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
