"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botón del formulario: spinner y deshabilitado mientras la acción corre. */
function SubmitIcon() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="icon"
      aria-label="Eliminar"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
    </Button>
  );
}

export function DeleteButton({
  id,
  action,
  confirmLabel,
}: {
  id: string;
  action: (formData: FormData) => void | Promise<void>;
  confirmLabel: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmLabel)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitIcon />
    </form>
  );
}
