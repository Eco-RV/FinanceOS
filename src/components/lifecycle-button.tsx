"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FormResult } from "@/lib/forms";

const MODES = {
  delete: { icon: Trash2, label: "Eliminar", done: "Eliminado" },
  deactivate: { icon: Archive, label: "Desactivar", done: "Desactivado" },
  activate: { icon: ArchiveRestore, label: "Activar", done: "Activado" },
} as const;

/**
 * Botón de ciclo de vida (G5): eliminar lo que no tiene historia, desactivar
 * lo que sí, o reactivar. Pide confirmación (salvo al activar) y muestra el
 * rechazo del caso de uso en un toast.
 */
export function LifecycleButton({
  id,
  mode,
  action,
  confirmLabel,
}: {
  id: string;
  mode: keyof typeof MODES;
  action: (formData: FormData) => Promise<FormResult>;
  confirmLabel?: string;
}) {
  const [pending, start] = useTransition();
  const { icon: Icon, label, done } = MODES[mode];

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => {
        if (confirmLabel && !window.confirm(confirmLabel)) return;
        const formData = new FormData();
        formData.set("id", id);
        formData.set("active", String(mode === "activate"));
        start(async () => {
          const result = await action(formData);
          if (result?.ok) toast.success(done);
          else toast.error(result?.message ?? "No se pudo completar la acción");
        });
      }}
    >
      <Icon className="size-4" />
    </Button>
  );
}
