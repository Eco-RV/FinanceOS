"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, PiggyBank, Undo2 } from "lucide-react";
import { toast } from "sonner";
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
import { confirmAction } from "@/lib/confirm";
import { useDialogForm } from "@/lib/use-dialog-form";
import { crToday, toISODate } from "@/domain";
import { formatCurrency } from "@/lib/format";
import { useFormatDate } from "@/components/date-format";
import { PrepaymentModePicker } from "../../prestamos/loan-adjustments";
import { prepayFinancingAction, undoFinancingPrepaymentAction } from "./actions";

/** F11: abono extraordinario al capital; las cuotas programadas se recalculan. */
export function PrepayFinancingDialog({
  financingId,
  currency,
  capitalPending,
  accounts,
}: {
  financingId: string;
  currency: string;
  capitalPending: number;
  accounts: { id: string; name: string }[];
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(prepayFinancingAction, "Abono registrado");
  const [mode, setMode] = useState<"term" | "payment">("term");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" disabled={accounts.length === 0} />}>
        <PiggyBank className="size-4" /> Abono extraordinario
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abono extraordinario al capital</DialogTitle>
          <DialogDescription>
            Capital por cobrar: {formatCurrency(capitalPending, currency)}. Sale de la cuenta como un gasto
            y las cuotas que faltan se recalculan con menos capital.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="financing_id" value={financingId} />
          <input type="hidden" name="mode" value={mode} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label={`Monto (${currency})`} htmlFor="fprepay-amount" error={errors?.amount}>
              <Input id="fprepay-amount" name="amount" type="number" step="0.01" min={0} inputMode="decimal" required />
            </FormField>
            <FormField label="Fecha" htmlFor="fprepay-date" error={errors?.occurred_on}>
              <Input id="fprepay-date" name="occurred_on" type="date" defaultValue={toISODate(crToday())} required />
            </FormField>
          </div>
          <FormField label={`Cuenta (${currency})`} htmlFor="fprepay-account" error={errors?.account_id}>
            <Select id="fprepay-account" name="account_id" defaultValue={accounts[0]?.id}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>
          <PrepaymentModePicker value={mode} onChange={setMode} />
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Registrar abono"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UndoFinancingPrepaymentButton({
  financingId,
  amount,
  occurredOn,
  currency,
}: {
  financingId: string;
  amount: number;
  occurredOn: string;
  currency: string;
}) {
  const formatDate = useFormatDate();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        const ok = await confirmAction({
          title: "¿Deshacer el último abono?",
          description: `Abono de ${formatCurrency(amount, currency)} del ${formatDate(occurredOn)}: vuelven las cuotas de antes y se borra el gasto.`,
          confirmLabel: "Deshacer",
          tone: "warning",
          icon: "undo",
        });
        if (!ok) return;
        const fd = new FormData();
        fd.set("financing_id", financingId);
        start(async () => {
          const r = await undoFinancingPrepaymentAction(fd);
          if (r?.ok) toast.success("Abono deshecho");
          else toast.error((r && !r.ok && r.message) || "No se pudo deshacer");
        });
      }}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Deshacer abono
    </Button>
  );
}
