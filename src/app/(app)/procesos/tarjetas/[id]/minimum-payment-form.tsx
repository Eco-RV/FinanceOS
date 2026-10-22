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
import { FormField } from "@/components/form-field";
import { useDialogForm } from "@/lib/use-dialog-form";
import { formatCurrency } from "@/lib/format";
import { useFormatDate } from "@/components/date-format";
import { saveMinimumPayment } from "../actions";
import { keepOnError } from "@/lib/keep-on-error";

/** T8: digitar el pago mínimo que trae el estado de cuenta del corte vigente. */
export function MinimumPaymentDialog({
  cardId,
  cutoffOn,
  currency,
  statementBalance,
  current,
}: {
  cardId: string;
  cutoffOn: string;
  currency: "CRC" | "USD";
  statementBalance: number;
  current: number | null;
}) {
  const formatDate = useFormatDate();
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveMinimumPayment,
    "Pago mínimo guardado",
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" className="h-7 px-2 text-xs" />}>
        {current ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
        {current ? "Editar mínimo" : "Digitar pago mínimo"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pago mínimo del corte del {formatDate(cutoffOn)}</DialogTitle>
          <DialogDescription>
            Cópialo de tu estado de cuenta: el banco lo calcula con su fórmula. Saldo al corte{" "}
            {formatCurrency(statementBalance, currency)}. Déjalo en blanco para quitarlo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          <input type="hidden" name="card_id" value={cardId} />
          <input type="hidden" name="cutoff_on" value={cutoffOn} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="statement_balance" value={statementBalance} />
          <FormField label={`Pago mínimo (${currency})`} htmlFor="minimum" error={errors?.amount}>
            <Input
              id="minimum"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              defaultValue={current ?? ""}
              autoFocus
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
