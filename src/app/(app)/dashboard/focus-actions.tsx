"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FeatureKey } from "@/domain";
import {
  closeFirstStepsAction,
  dismissSuggestionAction,
  reopenFirstStepsAction,
  setFeatureAction,
} from "../procesos/funciones/actions";

/** 3.2.0 (E5): cierra la tarjeta de primeros pasos. */
export function CloseStepsButton({ label = "Ocultar" }: { label?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await closeFirstStepsAction();
          if (!result?.ok) toast.error(result?.message ?? "No se pudo guardar");
        })
      }
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}
      {label}
    </Button>
  );
}

/** 3.2.0 (E4): "Activar" (y abrir) o "Ahora no" en la sugerencia del Resumen. */
export function SuggestionActions({ feature, label, href }: { feature: FeatureKey; label: string; href: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function activate() {
    start(async () => {
      const formData = new FormData();
      formData.set("feature", feature);
      formData.set("on", "true");
      const result = await setFeatureAction(formData);
      if (!result?.ok) {
        toast.error(result?.message ?? "No se pudo activar");
        return;
      }
      toast.success(`${label}: activada`);
      if (href) router.push(href);
    });
  }

  function dismiss() {
    start(async () => {
      const formData = new FormData();
      formData.set("feature", feature);
      const result = await dismissSuggestionAction(formData);
      if (!result?.ok) toast.error(result?.message ?? "No se pudo guardar");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" onClick={activate} disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Activar
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={dismiss} disabled={pending}>
        Ahora no
      </Button>
    </div>
  );
}

/** 3.2.0 (E5): "Ver de nuevo los primeros pasos" (desde Más funciones). */
export function ReopenStepsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await reopenFirstStepsAction();
          if (!result?.ok) toast.error(result?.message ?? "No se pudo guardar");
          else router.push("/dashboard");
        })
      }
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      Ver de nuevo los primeros pasos
    </Button>
  );
}
