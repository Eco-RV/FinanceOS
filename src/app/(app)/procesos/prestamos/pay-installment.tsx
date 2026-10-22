"use client";

import { useTransition } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
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
import { crToday, toISODate, type AmortizationRow } from "@/domain";
import { formatCurrency } from "@/lib/format";
import { useFormatDate } from "@/components/date-format";
import type { Account } from "@/lib/types";
import { payLoanInstallment, undoLoanInstallment } from "./actions";
import { keepOnError } from "@/lib/keep-on-error";

/** L2: paga la próxima cuota (la única que se puede pagar). */
export function PayInstallmentDialog({
  loanId,
  row,
  months,
  currency,
  accounts,
  defaultAccountId,
}: {
  loanId: string;
  row: AmortizationRow;
  months: number;
  currency: string;
  /** Cuentas activas en la moneda del préstamo. */
  accounts: Pick<Account, "id" | "name">[];
  defaultAccountId: string | null;
}) {
  const formatDate = useFormatDate();
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    payLoanInstallment,
    `Cuota ${row.no}/${months} pagada`,
  );
  const preselected = accounts.some((a) => a.id === defaultAccountId) ? defaultAccountId! : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={accounts.length === 0} />}>
        Pagar cuota {row.no}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Pagar cuota {row.no}/{months}
          </DialogTitle>
          <DialogDescription>
            Vence el {formatDate(row.occurred_on)}. Se registra como gasto desde la
            cuenta que elijas, con la fecha real del pago.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Cuota</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(row.payment, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Interés</dt>
            <dd className="tabular-nums">{formatCurrency(row.interest, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Capital</dt>
            <dd className="tabular-nums">{formatCurrency(row.principal, currency)}</dd>
          </div>
        </dl>

        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          <input type="hidden" name="loan_id" value={loanId} />
          <FormField label="Desde la cuenta" htmlFor="account_id" error={errors?.account_id}>
            <Select id="account_id" name="account_id" defaultValue={preselected} required>
              <option value="" disabled>
                Elige una cuenta…
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Fecha del pago" htmlFor="occurred_on" error={errors?.occurred_on}>
            <Input
              id="occurred_on"
              name="occurred_on"
              type="date"
              defaultValue={toISODate(crToday())}
              required
            />
          </FormField>

          {message ? <p className="text-sm text-destructive">{message}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Pagando…" : `Pagar ${formatCurrency(row.payment, currency)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** L5: deshace el pago de la última cuota (borra ese gasto). */
export function UndoLastPaymentButton({ loanId, installmentNo }: { loanId: string; installmentNo: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        const ok = await confirmAction({
          title: `¿Deshacer el pago de la cuota ${installmentNo}?`,
          description: "Se borra ese gasto y vuelve el saldo de la cuenta.",
          confirmLabel: "Deshacer",
          tone: "warning",
          icon: "undo",
        });
        if (!ok) return;
        const formData = new FormData();
        formData.set("id", loanId);
        start(async () => {
          const r = await undoLoanInstallment(formData);
          if (r?.ok) toast.success(`Pago de la cuota ${installmentNo} deshecho`);
          else toast.error(r?.message ?? "No se pudo deshacer el pago");
        });
      }}
    >
      <Undo2 className="size-4" /> Deshacer cuota {installmentNo}
    </Button>
  );
}
