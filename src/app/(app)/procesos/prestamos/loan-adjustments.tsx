"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Percent, PiggyBank, Undo2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { changeRateAction, prepayAction, undoAdjustmentAction } from "./actions";
import { keepOnError } from "@/lib/keep-on-error";

/**
 * Elegir si un abono baja el plazo o la cuota (L7/F11). Se usa también en
 * financiamientos.
 */
export function PrepaymentModePicker({ value, onChange }: { value: "term" | "payment"; onChange: (v: "term" | "payment") => void }) {
  return (
    <div role="radiogroup" aria-label="Qué baja el abono" className="grid grid-cols-2 gap-2">
      {(
        [
          ["term", "Baja el plazo", "Misma cuota, terminas antes"],
          ["payment", "Baja la cuota", "Mismo plazo, cuota menor"],
        ] as const
      ).map(([k, label, hint]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cn(
            "flex flex-col items-start gap-0.5 rounded-xl p-3 text-left text-sm transition-[background-color,box-shadow] duration-150",
            value === k ? "bg-primary/[0.06] ring-2 ring-primary dark:bg-primary/10" : "bg-muted/50 hover:bg-muted",
          )}
        >
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </button>
      ))}
    </div>
  );
}

/** L7: abono extraordinario al capital de un préstamo. */
export function PrepayLoanDialog({
  loanId,
  currency,
  remainingPrincipal,
  accounts,
  defaultAccountId,
}: {
  loanId: string;
  currency: string;
  remainingPrincipal: number;
  accounts: { id: string; name: string }[];
  defaultAccountId?: string | null;
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(prepayAction, "Abono registrado");
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
            Capital pendiente: {formatCurrency(remainingPrincipal, currency)}. Sale de la cuenta como
            un gasto en “Préstamos” y el calendario se recalcula.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          <input type="hidden" name="loan_id" value={loanId} />
          <input type="hidden" name="mode" value={mode} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label={`Monto (${currency})`} htmlFor="prepay-amount" error={errors?.amount}>
              <Input id="prepay-amount" name="amount" type="number" step="0.01" min={0} inputMode="decimal" required />
            </FormField>
            <FormField label="Fecha" htmlFor="prepay-date" error={errors?.occurred_on}>
              <Input id="prepay-date" name="occurred_on" type="date" defaultValue={toISODate(crToday())} required />
            </FormField>
          </div>
          <FormField label="Cuenta" htmlFor="prepay-account" error={errors?.account_id}>
            <Select
              id="prepay-account"
              name="account_id"
              defaultValue={accounts.some((a) => a.id === defaultAccountId) ? defaultAccountId! : accounts[0]?.id}
            >
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

/** L8: la tasa cambia desde una cuota que todavía no se pagó. */
export function ChangeRateDialog({
  loanId,
  nextNo,
  lastNo,
  currentRate,
}: {
  loanId: string;
  nextNo: number;
  lastNo: number;
  currentRate: number;
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(changeRateAction, "Tasa actualizada");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Percent className="size-4" /> Cambiar tasa
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambio de tasa (tasa variable)</DialogTitle>
          <DialogDescription>
            Tasa de ahora: {currentRate} % anual. Desde la cuota que elijas se usa la nueva; el plazo
            que queda se mantiene y la cuota se recalcula.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          <input type="hidden" name="loan_id" value={loanId} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nueva tasa anual (%)" htmlFor="rate" error={errors?.annual_rate}>
              <Input id="rate" name="annual_rate" type="number" step="0.001" min={0} max={100} required />
            </FormField>
            <FormField label="Desde la cuota" htmlFor="from_no" error={errors?.from_no}>
              <Input id="from_no" name="from_no" type="number" min={nextNo} max={lastNo} defaultValue={nextNo} required />
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

export function UndoAdjustmentButton({ loanId, label }: { loanId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        const ok = await confirmAction({
          title: "¿Deshacer el último ajuste?",
          description: `${label}. El calendario vuelve a como estaba${label.startsWith("Abono") ? " y se borra el gasto del abono" : ""}.`,
          confirmLabel: "Deshacer",
          tone: "warning",
          icon: "undo",
        });
        if (!ok) return;
        const fd = new FormData();
        fd.set("loan_id", loanId);
        start(async () => {
          const r = await undoAdjustmentAction(fd);
          if (r?.ok) toast.success("Ajuste deshecho");
          else toast.error((r && !r.ok && r.message) || "No se pudo deshacer");
        });
      }}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Deshacer último ajuste
    </Button>
  );
}
