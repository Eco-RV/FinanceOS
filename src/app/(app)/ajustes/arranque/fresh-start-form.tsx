"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { crToday, FRESH_START_CONFIRMATION, isFreshStartConfirmed, toISODate } from "@/domain";
import { formatCurrency } from "@/lib/format";
import { freshStartAction } from "./actions";

export type FreshStartRow = {
  /** `opening:<account|card>:<id>:<moneda>` */
  field: string;
  name: string;
  detail: string;
  currency: string;
  /** Saldo actual: valor sugerido. */
  current: number;
};

export function FreshStartForm({ rows }: { rows: FreshStartRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirmed = isFreshStartConfirmed(confirmation);

  return (
    <form
      className="flex flex-col gap-5"
      action={(formData) => {
        setError(null);
        start(async () => {
          const r = await freshStartAction(formData);
          if (r?.ok) {
            toast.success(
              "archived" in r
                ? `Arranque de 0 listo: ${r.archived} movimientos archivados`
                : "Arranque de 0 listo",
            );
            router.push("/dashboard");
          } else {
            setError(r?.message ?? Object.values(r?.errors ?? {})[0] ?? "No se pudo completar");
          }
        });
      }}
    >
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">Saldos iniciales nuevos</h2>
          <p className="text-sm text-muted-foreground">
            Vienen con el saldo de hoy. Corregilos con lo que diga el banco; 0 = sin saldo.
            En tarjetas es la deuda.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tenés cuentas ni tarjetas activas: el arranque solo archivará la historia.
          </p>
        ) : (
          <div className="surface divide-y overflow-hidden">
            {rows.map((r) => (
              <div key={r.field} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.detail} · hoy {formatCurrency(r.current, r.currency)}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{r.currency}</span>
                  <Input
                    name={r.field}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    defaultValue={r.current}
                    className="w-40 text-right tabular-nums"
                    aria-label={`Saldo inicial de ${r.name} en ${r.currency}`}
                    required
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Fecha de los saldos iniciales"
          htmlFor="on"
          hint="En tarjetas el saldo cuenta como cargo en esta fecha: si es anterior al último corte, entra al pago de contado vigente."
        >
          <Input id="on" name="on" type="date" defaultValue={toISODate(crToday())} required />
        </FormField>
        <FormField
          label={`Escribí ${FRESH_START_CONFIRMATION} para confirmar`}
          htmlFor="confirmation"
        >
          <Input
            id="confirmation"
            name="confirmation"
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </FormField>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div>
        <Button type="submit" variant="destructive" disabled={!confirmed || pending}>
          <RotateCcw className="size-4" />
          {pending ? "Arrancando…" : "Arrancar de 0"}
        </Button>
      </div>
    </form>
  );
}
