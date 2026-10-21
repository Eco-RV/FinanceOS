"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Undo2, Unlink } from "lucide-react";
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
import { REIMBURSEMENT_CHANNEL_LABELS } from "@/lib/schema";
import type { FormResult } from "@/lib/forms";
import { deleteSharedExpense, recordSharedPayment, undoSharedPayment } from "./actions";

type AccountOption = { id: string; name: string };

/**
 * X4: registrar que una persona pagó su parte. Opcional: "Registrar como
 * ingreso" en una cuenta de la misma moneda (si no, es solo control).
 */
export function SharedPaymentDialog({
  id,
  memberId,
  memberName,
  amount,
  currency,
  accounts,
  incomeCategories,
  lastAccountId,
}: {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  currency: string;
  /** Cuentas activas de la moneda del gasto. */
  accounts: AccountOption[];
  incomeCategories: string[];
  /** 04: la cuenta que se usó la última vez para cobrar (o la primera). */
  lastAccountId?: string | null;
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    recordSharedPayment,
    `${memberName} pagó ${formatCurrency(amount, currency)}`,
  );
  const [asIncome, setAsIncome] = useState(accounts.length > 0);
  const [channel, setChannel] = useState("sinpe");
  const suggestedCategory =
    incomeCategories.find((c) => /reembolso/i.test(c)) ?? incomeCategories[0] ?? "Reembolso";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-7 px-2 text-xs" />}>
        Pagó
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{memberName} te pagó</DialogTitle>
          <DialogDescription>
            Su parte: {formatCurrency(amount, currency)}. Elige si entra a una de tus cuentas o si es
            solo para llevar el control.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="member_id" value={memberId} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha" htmlFor="paid_on" error={errors?.paid_on}>
              <Input id="paid_on" name="paid_on" type="date" defaultValue={toISODate(crToday())} required />
            </FormField>
            <FormField label="Medio" htmlFor="channel" error={errors?.channel}>
              <Select id="channel" name="channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {Object.entries(REIMBURSEMENT_CHANNEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm select-none">
            <input
              type="checkbox"
              name="as_income"
              checked={asIncome}
              disabled={accounts.length === 0}
              onChange={(e) => setAsIncome(e.target.checked)}
              className="mt-0.5 size-4 accent-foreground"
            />
            <span>
              Registrar como ingreso en una cuenta
              <span className="block text-xs text-muted-foreground">
                {accounts.length === 0
                  ? `No tienes cuentas activas en ${currency}: quedará solo como control.`
                  : "Suma el monto al saldo de la cuenta. Desmárcalo si solo quieres llevar el control."}
              </span>
            </span>
          </label>
          {asIncome && accounts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Cuenta que recibió" htmlFor="account_id" error={errors?.account_id}>
                <Select
                  id="account_id"
                  name="account_id"
                  defaultValue={accounts.some((a) => a.id === lastAccountId) ? lastAccountId! : accounts[0].id}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Categoría de ingreso" htmlFor="category" error={errors?.category}>
                <Select id="category" name="category" defaultValue={suggestedCategory}>
                  {[...new Set([suggestedCategory, ...incomeCategories])].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          ) : null}

          <FormField label="Nota (opcional)" htmlFor="note" error={errors?.note}>
            <Input id="note" name="note" maxLength={120} />
          </FormField>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useAction(action: (fd: FormData) => Promise<FormResult>) {
  const [pending, start] = useTransition();
  const run = (fields: Record<string, string>, success: string, then?: () => void) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    start(async () => {
      const r = await action(fd);
      if (r?.ok) {
        toast.success(success);
        then?.();
      } else toast.error(r?.message ?? "No se pudo completar la acción");
    });
  };
  return { pending, run };
}

/** X4: deshacer un pago (y su ingreso, si lo tenía). */
export function SharedPaidBadge({
  id,
  memberId,
  paidOn,
  channelLabel,
  withIncome,
}: {
  id: string;
  memberId: string;
  paidOn: string;
  channelLabel: string;
  withIncome: boolean;
}) {
  const formatDate = useFormatDate();
  const { pending, run } = useAction(undoSharedPayment);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="size-3.5 text-success" /> {formatDate(paidOn)} · {channelLabel}
      {withIncome ? " · ingreso" : ""}
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label="Deshacer pago"
        title="Deshacer pago"
        disabled={pending}
        onClick={async () => {
          const ok = await confirmAction({
            title: "¿Deshacer este pago?",
            description: withIncome
              ? "La parte vuelve a quedar por cobrar y se borra el ingreso que se registró en la cuenta."
              : "La parte vuelve a quedar por cobrar.",
            confirmLabel: "Deshacer",
            tone: "warning",
            icon: "undo",
          });
          if (ok) run({ id, member_id: memberId }, "Pago deshecho");
        }}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
      </Button>
    </span>
  );
}

/** X6: dejar de compartir (el gasto queda en tus movimientos). */
export function UnshareButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction(deleteSharedExpense);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending || disabled}
      title={disabled ? "Primero deshaz los pagos registrados" : undefined}
      onClick={async () => {
        const ok = await confirmAction({
          title: "¿Dejar de compartir este gasto?",
          description: "Se borran el reparto y los avisos. El gasto sigue en tus movimientos.",
          confirmLabel: "Dejar de compartir",
          tone: "danger",
        });
        if (ok) run({ id }, "El gasto ya no está compartido", () => router.push("/procesos/compartidos"));
      }}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Unlink className="size-4" />} Dejar de
      compartir
    </Button>
  );
}
