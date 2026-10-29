"use client";

import { RefreshCw } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FOCUS_OUTLINE } from "@/lib/interactive";
import { cn } from "@/lib/utils";
import { setAutoApproveAction, syncNow } from "./actions";

export function SyncButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncNow();
          if (!r.ok) toast.error(r.message);
          else if (r.autoApproved !== null && r.autoApproved > 0) {
            toast.success(
              `${r.autoApproved} aceptada(s) sola(s)` +
                (r.left > 0 ? ` · ${r.left} por confirmar` : ""),
            );
          } else if (r.imported > 0) toast.success(`${r.imported} compra(s) nueva(s)`);
          else toast.message("Sin compras nuevas");
        })
      }
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Sincronizando…" : "Sincronizar"}
    </Button>
  );
}

/**
 * I7 (3.3.0): con el interruptor encendido, cada sincronización acepta sola
 * las compras con tarjeta: categoría de la regla del comercio u "Otros".
 */
export function AutoApproveToggle({ on }: { on: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(on);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !optimistic;
    start(async () => {
      setOptimistic(next);
      const r = await setAutoApproveAction(next);
      if (r?.ok) {
        toast.success(next ? "Las compras se aceptarán solas al sincronizar" : "Aceptación automática apagada");
      } else toast.error(r?.message ?? "No se pudo guardar");
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      onClick={toggle}
      disabled={pending}
      className={cn(
        "flex items-center gap-2 rounded-full text-sm font-medium disabled:opacity-70",
        FOCUS_OUTLINE,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-fluid",
          optimistic ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-background shadow-sm transition-transform duration-200 ease-fluid",
            optimistic ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </span>
      Aceptar solas al sincronizar
    </button>
  );
}
