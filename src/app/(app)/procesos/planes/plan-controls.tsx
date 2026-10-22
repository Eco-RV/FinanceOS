"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmAction } from "@/lib/confirm";
import { useFormAction } from "@/lib/use-form-action";
import { setBaselineCapAction, setPlanActiveAction } from "./actions";
import { keepOnError } from "@/lib/keep-on-error";

/** Pausar (deja de registrar) o reanudar (registra desde hoy). */
export function PlanPauseButton({ id, paused, name }: { id: string; paused: boolean; name: string }) {
  const [pending, start] = useTransition();
  const label = paused ? "Reanudar" : "Pausar";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={async () => {
        if (
          !paused &&
          !(await confirmAction({
            title: `¿Pausar "${name}"?`,
            description: "Deja de registrar sus fechas. Al reanudarlo sigue desde ese día, sin lo que se pausó.",
            confirmLabel: "Pausar",
            tone: "warning",
            icon: "archive",
          }))
        )
          return;
        const fd = new FormData();
        fd.set("id", id);
        fd.set("active", String(paused));
        start(async () => {
          const r = await setPlanActiveAction(fd);
          if (r?.ok) toast.success(paused ? "Plan reanudado" : "Plan pausado");
          else toast.error((r && !r.ok && r.message) || "No se pudo completar");
        });
      }}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : paused ? (
        <Play className="size-4" />
      ) : (
        <Pause className="size-4" />
      )}
    </Button>
  );
}

/** P4: tope de la línea base (% del salario). */
export function BaselineCapForm({ cap }: { cap: number }) {
  const [value, setValue] = useState(String(cap));
  const { submit, pending, errors } = useFormAction(setBaselineCapAction, "Tope guardado");
  return (
    <form onSubmit={keepOnError(submit)} className="flex flex-col gap-1">
      <label htmlFor="cap" className="text-xs text-muted-foreground">
        Tope de gastos fijos
      </label>
      <div className="flex items-center gap-2">
        <div className="relative w-24">
          <Input
            id="cap"
            name="cap"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={Boolean(errors?.cap) || undefined}
            className="pr-7"
          />
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending || value === String(cap)}>
          Guardar
        </Button>
      </div>
      {errors?.cap ? <p className="text-xs text-destructive">{errors.cap}</p> : null}
    </form>
  );
}
