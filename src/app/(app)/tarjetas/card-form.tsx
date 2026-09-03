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
import { CURRENCIES } from "@/lib/schema";
import { useDialogForm } from "@/lib/use-dialog-form";
import type { CreditCard } from "@/lib/types";
import { saveCard } from "./actions";

export function CardFormDialog({ card }: { card?: CreditCard }) {
  const editing = Boolean(card);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveCard,
    editing ? "Tarjeta actualizada" : "Tarjeta agregada",
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
            <Plus className="size-4" /> Nueva tarjeta
          </>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar tarjeta" : "Nueva tarjeta"}
          </DialogTitle>
          <DialogDescription>
            Datos del plástico y su ciclo de facturación.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          {card ? <input type="hidden" name="id" value={card.id} /> : null}

          <FormField label="Nombre" htmlFor="name" error={errors?.name}>
            <Input
              id="name"
              name="name"
              defaultValue={card?.name}
              placeholder="Ej. Amex Gold"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Institución (opcional)"
              htmlFor="institution"
              error={errors?.institution}
            >
              <Input
                id="institution"
                name="institution"
                defaultValue={card?.institution ?? ""}
              />
            </FormField>
            <FormField
              label="Últimos 4 (opcional)"
              htmlFor="last_four"
              error={errors?.last_four}
            >
              <Input
                id="last_four"
                name="last_four"
                inputMode="numeric"
                maxLength={4}
                defaultValue={card?.last_four ?? ""}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Día de corte"
              htmlFor="cutoff_day"
              error={errors?.cutoff_day}
              hint="Día del mes (1-31)"
            >
              <Input
                id="cutoff_day"
                name="cutoff_day"
                type="number"
                min={1}
                max={31}
                defaultValue={card?.cutoff_day ?? ""}
                required
              />
            </FormField>
            <FormField
              label="Día límite de pago"
              htmlFor="payment_due_day"
              error={errors?.payment_due_day}
              hint="Día del mes (1-31)"
            >
              <Input
                id="payment_due_day"
                name="payment_due_day"
                type="number"
                min={1}
                max={31}
                defaultValue={card?.payment_due_day ?? ""}
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                defaultValue={card?.current_balance ?? 0}
                required
              />
            </FormField>
            <FormField
              label="Límite de crédito"
              htmlFor="credit_limit"
              error={errors?.credit_limit}
            >
              <Input
                id="credit_limit"
                name="credit_limit"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={card?.credit_limit ?? ""}
              />
            </FormField>
          </div>

          <FormField label="Moneda" htmlFor="currency">
            <Select
              id="currency"
              name="currency"
              defaultValue={card?.currency ?? "MXN"}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
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
