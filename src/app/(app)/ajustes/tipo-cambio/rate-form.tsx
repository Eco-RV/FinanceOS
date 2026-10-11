"use client";

import { Plus } from "lucide-react";
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
import { crToday, toISODate } from "@/domain";
import { saveExchangeRate } from "./actions";

export function RateFormDialog({ lastRate }: { lastRate?: number }) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveExchangeRate,
    "Tipo de cambio guardado",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Registrar tipo de cambio
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tipo de cambio</DialogTitle>
          <DialogDescription>
            Colones por 1 dólar. Se usa para calcular el disponible de las tarjetas con saldo
            en otra moneda. Si ya hay uno para esa fecha, se reemplaza.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="₡ por $1" htmlFor="usd_crc" error={errors?.usd_crc}>
              <Input
                id="usd_crc"
                name="usd_crc"
                type="number"
                step="0.0001"
                inputMode="decimal"
                defaultValue={lastRate ?? ""}
                required
              />
            </FormField>
            <FormField label="Fecha" htmlFor="rate_on" error={errors?.rate_on}>
              <Input
                id="rate_on"
                name="rate_on"
                type="date"
                defaultValue={toISODate(crToday())}
                required
              />
            </FormField>
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
