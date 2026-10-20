"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";
import { confirmOccurrenceAction } from "./actions";

/**
 * P7 (3.0.1): una ocurrencia de un plan variable entró con el monto estimado;
 * aquí se pone el real. Viene lleno con el estimado (ley de Parkinson).
 */
export function ConfirmOccurrenceRow({
  movementId,
  name,
  occurredOn,
  amount,
  currency,
}: {
  movementId: string;
  name: string;
  occurredOn: string;
  amount: number;
  currency: string;
}) {
  const [value, setValue] = useState(String(amount));
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(occurredOn)} · estimado {formatCurrency(amount, currency)}
        </p>
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData();
          fd.set("movement_id", movementId);
          fd.set("amount", value.replace(",", "."));
          start(async () => {
            const r = await confirmOccurrenceAction(fd);
            if (r?.ok) toast.success("Monto confirmado");
            else toast.error((r && !r.ok && r.message) || "No se pudo confirmar");
          });
        }}
      >
        <Input
          aria-label={`Monto real de ${name}`}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
          className="w-32 text-right tabular-nums"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Confirmar
        </Button>
      </form>
    </li>
  );
}
