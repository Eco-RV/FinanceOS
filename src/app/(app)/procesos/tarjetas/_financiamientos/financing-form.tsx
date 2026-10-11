"use client";

import { useState } from "react";
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
import { FormField, Select } from "@/components/form-field";
import { useDialogForm } from "@/lib/use-dialog-form";
import { crToday, toISODate } from "@/domain";
import { formatCurrency } from "@/lib/format";
import { createFinancing } from "./actions";

type Props = {
  cardId: string;
  currency: string;
  categories?: string[];
};

export function FinancingForm({ cardId, currency, categories = [] }: Props) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    createFinancing,
    "Financiamiento creado",
  );

  const [totalAmount, setTotalAmount] = useState("");
  const [months, setMonths] = useState("");

  const preview =
    Number(totalAmount) > 0 && Number(months) >= 2
      ? Number(totalAmount) / Number(months)
      : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nuevo financiamiento
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo financiamiento</DialogTitle>
          <DialogDescription>
            Reparte el monto total en cuotas mensuales iguales (tasa 0, sin
            intereses). El total baja el disponible de la tarjeta de inmediato.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="card_id" value={cardId} />

          <FormField
            label="Descripción"
            htmlFor="description"
            error={errors?.description}
          >
            <Input id="description" name="description" required />
          </FormField>

          <FormField label="Categoría" htmlFor="category" error={errors?.category}>
            <Select id="category" name="category" defaultValue="">
              <option value="">Elegí una categoría…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={`Monto total (${currency})`}
              htmlFor="total_amount"
              error={errors?.total_amount}
            >
              <Input
                id="total_amount"
                name="total_amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Meses" htmlFor="months" error={errors?.months}>
              <Input
                id="months"
                name="months"
                type="number"
                min={2}
                max={48}
                step={1}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                required
              />
            </FormField>
          </div>

          {preview != null ? (
            <p className="text-xs text-muted-foreground">
              Cuota mensual aprox.: {formatCurrency(preview, currency)}
            </p>
          ) : null}

          <FormField
            label="Fecha de la compra / primera cuota"
            htmlFor="first_charge_on"
            error={errors?.first_charge_on}
          >
            <Input
              id="first_charge_on"
              name="first_charge_on"
              type="date"
              defaultValue={toISODate(crToday())}
              required
            />
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
