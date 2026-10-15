"use client";

import { useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAction, splitQuestion } from "@/lib/confirm";

/**
 * Eliminar con confirmación (diálogo de la app, 2.5.0): spinner y
 * deshabilitado mientras la acción corre.
 */
export function DeleteButton({
  id,
  action,
  confirmLabel,
}: {
  id: string;
  action: (formData: FormData) => void | Promise<void>;
  confirmLabel: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Eliminar"
      title="Eliminar"
      disabled={pending}
      aria-busy={pending}
      onClick={async () => {
        const ok = await confirmAction({
          ...splitQuestion(confirmLabel),
          confirmLabel: "Eliminar",
          tone: "danger",
          icon: "delete",
        });
        if (!ok) return;
        const formData = new FormData();
        formData.set("id", id);
        start(async () => {
          await action(formData);
        });
      }}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}
