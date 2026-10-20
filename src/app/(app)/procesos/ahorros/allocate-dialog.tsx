"use client";

import { Wallet } from "lucide-react";
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
import { allocateGoalAction } from "./actions";

/** A4: cuánto del saldo de la cuenta se aparta para esta meta. */
export function AllocateDialog({
  goalId,
  goalName,
  currency,
  current,
  available,
}: {
  goalId: string;
  goalName: string;
  currency: string;
  current: number;
  /** Lo máximo que se le puede apartar (lo libre + lo que ya tiene). */
  available: number;
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(allocateGoalAction, "Apartado guardado");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Wallet className="size-4" /> Apartar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apartar para {goalName}</DialogTitle>
          <DialogDescription>
            La cuenta tiene varias metas: cada una cuenta lo que le apartes. Puedes apartar hasta{" "}
            {formatCurrency(available, currency)}.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="goal_id" value={goalId} />
          <FormField label={`Apartado (${currency})`} htmlFor="allocated" error={errors?.allocated}>
            <Input
              id="allocated"
              name="allocated"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              defaultValue={current || ""}
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
