"use client";

import { useState, useTransition } from "react";
import { ExternalLink, LoaderCircle, Paperclip, Trash2 } from "lucide-react";
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
import { useDialogForm } from "@/lib/use-dialog-form";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { attachReceiptAction, openReceiptAction, removeReceiptAction } from "./actions";

/** G8 (3.0.1): adjuntar, ver o quitar el comprobante de un movimiento. */
export function ReceiptDialog({ movementId, hasReceipt }: { movementId: string; hasReceipt: boolean }) {
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(attachReceiptAction, "Comprobante guardado");
  const [busy, start] = useTransition();
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={hasReceipt ? "Ver comprobante" : "Adjuntar comprobante"}
            title={hasReceipt ? "Ver comprobante" : "Adjuntar comprobante"}
            className={cn(hasReceipt && "text-foreground", !hasReceipt && "text-muted-foreground")}
          />
        }
      >
        <Paperclip className={cn("size-4", hasReceipt && "fill-current/20")} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comprobante</DialogTitle>
          <DialogDescription>
            Factura, recibo o foto del voucher: JPG, PNG, WebP o PDF de hasta 5 MB. Solo tú lo ves.
          </DialogDescription>
        </DialogHeader>
        {hasReceipt ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const fd = new FormData();
                  fd.set("movement_id", movementId);
                  const r = await openReceiptAction(fd);
                  if (r.ok) window.open(r.url, "_blank", "noopener");
                  else toast.error(r.message);
                })
              }
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ExternalLink className="size-4" />} Ver
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                const ok = await confirmAction({
                  title: "¿Quitar el comprobante?",
                  description: "Se borra el archivo; el movimiento no cambia.",
                  confirmLabel: "Quitar",
                  tone: "danger",
                  icon: "delete",
                });
                if (!ok) return;
                start(async () => {
                  const fd = new FormData();
                  fd.set("movement_id", movementId);
                  const r = await removeReceiptAction(fd);
                  if (r?.ok) {
                    toast.success("Comprobante quitado");
                    setOpen(false);
                  } else toast.error((r && !r.ok && r.message) || "No se pudo quitar");
                });
              }}
            >
              <Trash2 className="size-4" /> Quitar
            </Button>
          </div>
        ) : null}
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="movement_id" value={movementId} />
          <label className="flex cursor-pointer flex-col gap-1 text-sm">
            <span className="font-medium">{hasReceipt ? "Reemplazar por otro" : "Archivo"}</span>
            <Input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              onChange={(e) => setName(e.target.files?.[0]?.name ?? "")}
            />
            {name ? <span className="truncate text-xs text-muted-foreground">{name}</span> : null}
          </label>
          {errors?.file ? <p className="text-sm text-destructive">{errors.file}</p> : null}
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Subiendo…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
