"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select } from "@/components/form-field";
import type { AppPreferences } from "@/domain";
import { savePreferencesAction } from "./actions";

const EXAMPLE = new Date(2026, 9, 18);
const FORMATS = [
  ["corto", new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "short", year: "numeric" }).format(EXAMPLE)],
  ["numerico", new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(EXAMPLE)],
  ["largo", new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "long", year: "numeric" }).format(EXAMPLE)],
] as const;

/** U9 (3.1.0): moneda base y formato de fecha; se guardan al elegir. */
export function AppPreferencesForm({ value, disabled }: { value: AppPreferences; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const save = (key: string, v: string) => {
    const fd = new FormData();
    fd.set(key, v);
    start(async () => {
      const r = await savePreferencesAction(fd);
      if (r?.ok) toast.success("Preferencia guardada");
      else toast.error((r && !r.ok && r.message) || "No se pudo guardar");
    });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Moneda base</span>
        <Select value={value.baseCurrency} disabled={disabled || pending} onChange={(e) => save("baseCurrency", e.target.value)}>
          <option value="CRC">Colones (₡)</option>
          <option value="USD">Dólares ($)</option>
        </Select>
        <span className="text-xs text-muted-foreground">
          Con la que abre el gasto rápido y en la que el Resumen muestra el patrimonio.
        </span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Formato de fecha</span>
        <Select value={value.dateFormat} disabled={disabled || pending} onChange={(e) => save("dateFormat", e.target.value)}>
          {FORMATS.map(([k, example]) => (
            <option key={k} value={k}>
              {example}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground">Cómo se muestran las fechas en toda la app.</span>
      </label>
    </div>
  );
}
