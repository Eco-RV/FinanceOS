"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Eliminar"
      >
        <Trash2 className="size-4" />
      </Button>
    </form>
  );
}
