"use client";

import { useTransition } from "react";
import { Check, LoaderCircle, Mail, MessageCircle, Undo2, Users } from "lucide-react";
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
import { crToday, toISODate } from "@/domain";
import { formatCurrency } from "@/lib/format";
import { useFormatDate } from "@/components/date-format";
import { REIMBURSEMENT_CHANNEL_LABELS } from "@/lib/schema";
import type { FormResult } from "@/lib/forms";
import {
  recordReimbursement,
  recordWhatsappNotice,
  saveFinancingShares,
  sendEmailNotice,
  undoReimbursement,
} from "./actions";
import { keepOnError } from "@/lib/keep-on-error";

type MemberOption = { id: string; name: string };

/** F6: monto fijo por cuota de cada miembro; el resto es del usuario. */
export function SharesDialog({
  financingId,
  currency,
  minInstallment,
  members,
  shares,
}: {
  financingId: string;
  currency: string;
  /** La cuota más baja del plan: las partes no la pueden pasar. */
  minInstallment: number;
  /** Activos, más los desactivados que ya tienen parte. */
  members: MemberOption[];
  shares: Record<string, number>;
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveFinancingShares,
    "Reparto guardado",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Users className="size-4" /> Repartir cuotas
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repartir cuotas</DialogTitle>
          <DialogDescription>
            Cuánto paga cada miembro por cuota. Lo que sobra es tu parte. La suma
            no puede pasar {formatCurrency(minInstallment, currency)} (la cuota más
            baja). Dejá en blanco a quien no participa.
          </DialogDescription>
        </DialogHeader>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Primero agrega miembros en Ajustes → Miembros.
          </p>
        ) : (
          <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
            <input type="hidden" name="financing_id" value={financingId} />
            {members.map((m) => (
              <FormField
                key={m.id}
                label={`${m.name} (${currency})`}
                htmlFor={`share-${m.id}`}
                error={errors?.[`share:${m.id}`]}
              >
                <Input
                  id={`share-${m.id}`}
                  name={`share:${m.id}`}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={shares[m.id] ?? ""}
                />
              </FormField>
            ))}
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** F7: registrar que un miembro pagó su parte de una cuota. */
export function ReimburseDialog({
  financingId,
  memberId,
  memberName,
  installmentNo,
  months,
  amount,
  currency,
}: {
  financingId: string;
  memberId: string;
  memberName: string;
  installmentNo: number;
  months: number;
  amount: number;
  currency: string;
}) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    recordReimbursement,
    `${memberName} pagó la cuota ${installmentNo}`,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="h-9 px-2 text-xs sm:h-7" />}>
        Pagó
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {memberName} · cuota {installmentNo}/{months}
          </DialogTitle>
          <DialogDescription>
            Registra que te pagó su parte ({formatCurrency(amount, currency)}). Es
            un control interno: no cambia la tarjeta ni tus cuentas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          <input type="hidden" name="financing_id" value={financingId} />
          <input type="hidden" name="member_id" value={memberId} />
          <input type="hidden" name="installment_no" value={installmentNo} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha" htmlFor="paid_on" error={errors?.paid_on}>
              <Input
                id="paid_on"
                name="paid_on"
                type="date"
                defaultValue={toISODate(crToday())}
                required
              />
            </FormField>
            <FormField label="Medio" htmlFor="channel" error={errors?.channel}>
              <Select id="channel" name="channel" defaultValue="sinpe">
                {Object.entries(REIMBURSEMENT_CHANNEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Nota (opcional)" htmlFor="note" error={errors?.note}>
            <Input id="note" name="note" maxLength={120} />
          </FormField>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useFormAction(action: (formData: FormData) => Promise<FormResult>) {
  const [pending, start] = useTransition();
  const run = (fields: Record<string, string>, success: string, then?: () => void) => {
    const formData = new FormData();
    for (const [k, v] of Object.entries(fields)) formData.set(k, v);
    start(async () => {
      const r = await action(formData);
      if (r?.ok) {
        toast.success(success);
        then?.();
      } else toast.error(r?.message ?? "No se pudo completar la acción");
    });
  };
  return { pending, run };
}

export function ReimbursedBadge({ id, paidOn }: { id: string; paidOn: string }) {
  const formatDate = useFormatDate();
  const { pending, run } = useFormAction(undoReimbursement);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="size-3.5" /> {formatDate(paidOn)}
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label="Deshacer reembolso"
        title="Deshacer reembolso"
        disabled={pending}
        onClick={async () => {
          const ok = await confirmAction({
            title: "¿Deshacer este reembolso?",
            description: "La cuota vuelve a quedar pendiente de cobro para el miembro.",
            confirmLabel: "Deshacer",
            tone: "warning",
            icon: "undo",
          });
          if (!ok) return;
          run({ id }, "Reembolso deshecho");
        }}
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Undo2 className="size-3.5" />
        )}
      </Button>
    </span>
  );
}

type NoticeKey = { memberId: string; dueOn: string; currency: string };

type NoticeAction = (formData: FormData) => Promise<FormResult>;

/**
 * F8/X5: abre WhatsApp con el mensaje listo y deja constancia del aviso.
 * `action` registra el aviso (por defecto, el de cuotas de financiamiento).
 */
export function WhatsappNoticeButton({
  notice,
  url,
  action = recordWhatsappNotice,
}: {
  notice: NoticeKey;
  url: string;
  action?: NoticeAction;
}) {
  const { pending, run } = useFormAction(action);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        // Se abre en el mismo gesto del clic (si no, el navegador lo bloquea).
        window.open(url, "_blank", "noopener");
        run(
          { member_id: notice.memberId, due_on: notice.dueOn, currency: notice.currency },
          "Aviso por WhatsApp registrado",
        );
      }}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <MessageCircle className="size-4" />
      )}{" "}
      WhatsApp
    </Button>
  );
}

/** F8/X5: envía el aviso desde el Gmail conectado. */
export function EmailNoticeButton({
  notice,
  action = sendEmailNotice,
}: {
  notice: NoticeKey;
  action?: NoticeAction;
}) {
  const { pending, run } = useFormAction(action);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        run(
          { member_id: notice.memberId, due_on: notice.dueOn, currency: notice.currency },
          "Aviso enviado por correo",
        )
      }
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <Mail className="size-4" />
      )}{" "}
      {pending ? "Enviando…" : "Correo"}
    </Button>
  );
}
