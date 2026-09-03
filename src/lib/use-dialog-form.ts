"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { FormResult } from "@/lib/forms";

type ServerAction = (
  prev: FormResult,
  formData: FormData,
) => Promise<FormResult>;

/**
 * Drives a dialog form backed by a server action: tracks open state and pending,
 * closes + toasts on success, and surfaces validation errors otherwise.
 */
export function useDialogForm(action: ServerAction, successMessage: string) {
  const [open, setOpenState] = useState(false);
  const [result, setResult] = useState<FormResult>(undefined);
  const [pending, startTransition] = useTransition();

  function setOpen(next: boolean) {
    setOpenState(next);
    if (!next) setResult(undefined);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await action(undefined, formData);
      if (res?.ok) {
        setResult(undefined);
        setOpenState(false);
        toast.success(successMessage);
      } else {
        setResult(res);
      }
    });
  }

  const errors = result && !result.ok ? result.errors : undefined;
  const message = result && !result.ok ? result.message : undefined;

  return { open, setOpen, submit, pending, errors, message };
}
