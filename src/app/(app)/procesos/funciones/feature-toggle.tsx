"use client";

import { useTransition } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FeatureKey } from "@/domain";
import { setFeatureAction } from "./actions";

/** 3.2.0: Activar / Apagar una función del catálogo. */
export function FeatureToggle({ feature, label, on }: { feature: FeatureKey; label: string; on: boolean }) {
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const formData = new FormData();
      formData.set("feature", feature);
      formData.set("on", String(!on));
      const result = await setFeatureAction(formData);
      if (result?.ok) toast.success(on ? `${label}: apagada` : `${label}: activada`);
      else toast.error(result?.message ?? "No se pudo guardar");
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={on ? "ghost" : "default"}
      onClick={toggle}
      disabled={pending}
      aria-label={on ? `Apagar ${label}` : `Activar ${label}`}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : on ? null : <Plus className="size-4" />}
      {on ? "Apagar" : "Activar"}
    </Button>
  );
}
