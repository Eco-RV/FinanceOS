"use client";

import { useEffect, useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Archive, CircleHelp, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONFIRM_EVENT, type ConfirmRequest } from "@/lib/confirm";
import { cn } from "@/lib/utils";

const ICONS = { delete: Trash2, archive: Archive, undo: RotateCcw } as const;

const TONE = {
  danger: "bg-destructive/12 text-destructive",
  warning: "bg-warning/15 text-warning",
  default: "bg-muted text-foreground/80",
} as const;

/**
 * Diálogo de confirmación de la app (2.5.0). Se monta una vez en el layout
 * raíz y atiende `confirmAction()`: eliminar, desactivar, deshacer.
 */
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const answered = useRef(false);

  useEffect(() => {
    function onConfirm(e: Event) {
      const detail = (e as CustomEvent<ConfirmRequest>).detail;
      answered.current = false;
      setRequest(detail);
      setOpen(true);
    }
    window.addEventListener(CONFIRM_EVENT, onConfirm);
    return () => window.removeEventListener(CONFIRM_EVENT, onConfirm);
  }, []);

  function answer(ok: boolean) {
    if (!request || answered.current) return;
    answered.current = true;
    request.resolve(ok);
    setOpen(false);
  }

  const tone = request?.tone ?? "danger";
  const Icon = request?.icon
    ? ICONS[request.icon]
    : tone === "default"
      ? CircleHelp
      : Trash2;

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) answer(false);
      }}
      onOpenChangeComplete={(next) => {
        if (!next) setRequest(null);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[80] bg-black/65 duration-200 dark:bg-black/70 ease-fluid supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-popover p-5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 duration-200 ease-fluid outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="flex items-start gap-3.5">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", TONE[tone])}>
              <Icon className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
              <AlertDialog.Title className="text-base leading-snug font-semibold tracking-tight">
                {request?.title}
              </AlertDialog.Title>
              {request?.description ? (
                <AlertDialog.Description className="text-sm text-muted-foreground">
                  {request.description}
                </AlertDialog.Description>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => answer(false)}>
              Cancelar
            </Button>
            <Button
              className={cn(tone === "danger" && "bg-destructive text-white hover:bg-destructive/90")}
              autoFocus
              onClick={() => answer(true)}
            >
              {request?.confirmLabel ?? "Confirmar"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
