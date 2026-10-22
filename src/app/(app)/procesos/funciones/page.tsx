import type { ComponentType, CSSProperties } from "react";
import Link from "next/link";
import {
  Banknote,
  ChartColumn,
  CalendarClock,
  HandCoins,
  HandHeart,
  Inbox,
  PiggyBank,
  Repeat,
  Users,
  Wrench,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { FEATURES, isFeatureEnabled, type FeatureKey } from "@/domain";
import { getFeatureState } from "@/lib/features";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { FOCUS_OUTLINE } from "@/lib/interactive";
import { cn } from "@/lib/utils";
import { FeatureToggle } from "./feature-toggle";
import { ReopenStepsButton } from "../../dashboard/focus-actions";

const ICONS: Record<FeatureKey, ComponentType<{ className?: string }>> = {
  ingresos: Banknote,
  planes: Repeat,
  analisis: ChartColumn,
  financiamientos: CalendarClock,
  prestamos: HandCoins,
  ahorros: PiggyBank,
  compartidos: Users,
  cobros: HandHeart,
  gmail: Inbox,
  herramientas: Wrench,
};

/**
 * 3.2.0 · Fase 2 (E1–E3): catálogo de funciones. El núcleo (no pagar
 * intereses) siempre está; lo demás se activa o se apaga aquí.
 */
export default async function FuncionesPage() {
  const [, state] = await Promise.all([requireUser(), getFeatureState()]);
  const features = FEATURES.map((f) => ({ ...f, on: isFeatureEnabled(state, f.key) }));
  // Primero lo activo; dentro de cada grupo, el orden del catálogo.
  const sorted = [...features.filter((f) => f.on), ...features.filter((f) => !f.on)];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Más funciones</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Finance OS empieza por lo esencial: que no pagues intereses en tus tarjetas. Activa lo demás cuando lo
          necesites; lo puedes apagar cuando quieras y tus datos no se borran.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {sorted.map(({ key, label, pitch, beta, routes, on }, i) => {
          const Icon = ICONS[key];
          return (
            <li
              key={key}
              className="surface rise flex flex-col gap-3 p-4"
              style={{ "--rise-i": i } as CSSProperties}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg",
                    on ? "bg-primary/10 text-primary" : "bg-muted text-foreground/70",
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold tracking-tight">{label}</h2>
                    {beta ? <Badge variant="secondary">beta</Badge> : null}
                    {on ? <Badge variant="outline">Activa</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{pitch}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                {on && routes[0] ? (
                  <Link
                    href={routes[0]}
                    className={cn("rounded-md px-2 py-1 text-sm font-medium text-primary hover:underline", FOCUS_OUTLINE)}
                  >
                    Abrir
                  </Link>
                ) : null}
                <FeatureToggle feature={key} label={label} on={on} />
              </div>
            </li>
          );
        })}
      </ul>

      {state.stepsClosed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">¿Quieres repasar cómo no pagar intereses?</p>
          <ReopenStepsButton />
        </div>
      ) : null}
    </div>
  );
}
