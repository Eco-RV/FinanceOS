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
  financingProgress,
  financingSchedule,
  isCurrency,
  MAX_FINANCING_MONTHS,
  toISODate,
} from "@/domain";
import { formatCurrency } from "@/lib/format";
import type { Financing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createFinancing, updateFinancing } from "./actions";

type Props = {
  cardId: string;
  currency: string;
  categories?: string[];
};

/** Cuota e intereses con los mismos cálculos del dominio (F1, F5). */
function previewOf(amount: string, rate: string, months: string, currency: string) {
  try {
    const plan = financingSchedule({
      principal: Number(amount),
      annualRatePercent: Number(rate || 0),
      months: Number(months),
      firstChargeOn: toISODate(crToday()),
      currency: isCurrency(currency) ? currency : "CRC",
    });
    const p = financingProgress(plan, "0000-00-00");
    return { payment: plan[0].amount, totalInterest: p.totalInterest, totalCost: p.totalCost };
  } catch {
    return null;
  }
}

function CategorySelect({
  categories,
  defaultValue = "",
  error,
}: {
  categories: string[];
  defaultValue?: string;
  error?: string;
}) {
  // Conserva la categoría actual aunque ya no esté en la lista (G4 al editar).
  const options =
    defaultValue && !categories.includes(defaultValue) ? [defaultValue, ...categories] : categories;
  return (
    <FormField label="Categoría" htmlFor="category" error={error}>
      <Select id="category" name="category" defaultValue={defaultValue}>
        <option value="">Elegí una categoría…</option>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

export function FinancingForm({ cardId, currency: limitCurrency, categories = [] }: Props) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    createFinancing,
    "Financiamiento creado",
  );

  const [totalAmount, setTotalAmount] = useState("");
  const [rate, setRate] = useState("0");
  const [months, setMonths] = useState("");
  // F10 (3.1.0): por defecto la moneda del límite; se puede financiar en la otra (T1).
  const [currency, setCurrency] = useState(limitCurrency);
  const preview = previewOf(totalAmount, rate, months, currency);
  const withInterest = Number(rate) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nuevo financiamiento
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo financiamiento</DialogTitle>
          <DialogDescription>
            Compra a cuotas mensuales sobre la tarjeta. Con tasa 0 las cuotas son
            iguales; con tasa, cada cuota trae interés y abono al capital (cuota
            fija). El capital baja el disponible de inmediato; el interés de cada
            cuota cuenta cuando llega su fecha.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="card_id" value={cardId} />
          <input type="hidden" name="currency" value={currency} />

          <FormField
            label="Descripción"
            htmlFor="description"
            error={errors?.description}
          >
            <Input id="description" name="description" required maxLength={80} />
          </FormField>

          <CategorySelect categories={categories} error={errors?.category} />

          <div role="radiogroup" aria-label="Moneda del financiamiento" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["CRC", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setCurrency(c)}
                className={cn(
                  "h-8 rounded-lg text-sm transition-[background-color,color,box-shadow] duration-200",
                  currency === c
                    ? "bg-card font-medium text-foreground shadow-sm dark:bg-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "CRC" ? "Colones (₡)" : "Dólares ($)"}
              </button>
            ))}
          </div>
          {currency !== limitCurrency ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              Las cuotas van al saldo en {currency === "USD" ? "dólares" : "colones"} de la tarjeta; el
              disponible las convierte con el último tipo de cambio.
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <FormField
              label={withInterest ? `Capital (${currency})` : `Monto total (${currency})`}
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
            <FormField label="Tasa anual (%)" htmlFor="annual_rate" error={errors?.annual_rate}>
              <Input
                id="annual_rate"
                name="annual_rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </FormField>
            <FormField label="Meses" htmlFor="months" error={errors?.months}>
              <Input
                id="months"
                name="months"
                type="number"
                min={2}
                max={MAX_FINANCING_MONTHS}
                step={1}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                required
              />
            </FormField>
          </div>

          {preview ? (
            <p className="text-xs text-muted-foreground">
              Cuota mensual: {formatCurrency(preview.payment, currency)}
              {preview.totalInterest > 0
                ? ` · intereses ${formatCurrency(preview.totalInterest, currency)} · total ${formatCurrency(preview.totalCost, currency)}`
                : " · sin intereses"}
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

/** F9: editar descripción y categoría (los términos no se editan). */
export function FinancingEditDialog({
  financing,
  categories = [],
}: {
  financing: Pick<Financing, "id" | "description" | "category">;
  categories?: string[];
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    updateFinancing,
    "Financiamiento actualizado",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Editar" title="Editar" />}>
        <Pencil className="size-4" />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar financiamiento</DialogTitle>
          <DialogDescription>
            Cambia la descripción y la categoría del plan y de sus cuotas. El
            monto, la tasa, los meses y la fecha no se editan: para cambiarlos,
            eliminá el plan y creá otro.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={financing.id} />
          <FormField label="Descripción" htmlFor="description" error={errors?.description}>
            <Input
              id="description"
              name="description"
              defaultValue={financing.description}
              required
              maxLength={80}
            />
          </FormField>
          <CategorySelect
            categories={categories}
            defaultValue={financing.category ?? ""}
            error={errors?.category}
          />

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
