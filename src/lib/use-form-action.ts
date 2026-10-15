"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { FormResult } from "@/lib/forms";

type ServerAction = (prev: FormResult, formData: FormData) => Promise<FormResult>;

/**
 * Formulario de página (no de diálogo) con una Server Action (2.6.0): pending,
 * errores por campo y toast al guardar. `onSuccess` permite limpiar campos.
 */
export function useFormAction(
  action: ServerAction,
  successMessage: string,
  onSuccess?: () => void,
) {
  const [result, setResult] = useState<FormResult>(undefined);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await action(undefined, formData);
      setResult(res);
      if (res?.ok) {
        toast.success(successMessage);
        onSuccess?.();
      }
    });
  }

  const errors = result && !result.ok ? result.errors : undefined;
  const message = result && !result.ok ? result.message : undefined;
  return { submit, pending, errors, message, done: Boolean(result?.ok) };
}
