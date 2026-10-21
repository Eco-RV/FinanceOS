import type { CSSProperties } from "react";
import Link from "next/link";
import { Check, Lightbulb, PartyPopper } from "lucide-react";
import { FEATURES, type FirstStep, type FirstStepKey, type Suggestion } from "@/domain";
import { FOCUS_OUTLINE } from "@/lib/interactive";
import { cn } from "@/lib/utils";
import { CloseStepsButton, SuggestionActions } from "./focus-actions";

const STEPS: Record<FirstStepKey, { title: string; hint: string; href: string; cta: string }> = {
  tarjeta: {
    title: "Agrega tu tarjeta de crédito",
    hint: "Banco, día de corte, día de pago y el saldo que tiene hoy.",
    href: "/procesos/tarjetas",
    cta: "Agregar tarjeta",
  },
  cuenta: {
    title: "Agrega la cuenta con la que la pagas",
    hint: "Tu cuenta de débito o de ahorro, con su saldo de hoy.",
    href: "/procesos/cuentas",
    cta: "Agregar cuenta",
  },
  compra: {
    title: "Registra una compra con la tarjeta",
    hint: "Con el botón rojo de la flecha hacia arriba, en cualquier pantalla.",
    href: "/procesos/gastos",
    cta: "Ver gastos",
  },
  pago: {
    title: "Registra el pago de la tarjeta",
    hint: "Desde el detalle de la tarjeta, con “Registrar pago”.",
    href: "/procesos/tarjetas",
    cta: "Ir a tarjetas",
  },
};

/**
 * 3.2.0 · Fase 2 (E5): el camino del primer uso, con la promesa de la app.
 * Sale de los datos; se cierra a mano (también al terminar).
 */
export function FirstStepsCard({ steps, style }: { steps: FirstStep[]; style?: CSSProperties }) {
  const done = steps.filter((s) => s.done).length;
  const allDone = done === steps.length;
  const next = steps.find((s) => !s.done)?.key;
  const canSeeResult = steps.find((s) => s.key === "tarjeta")?.done && steps.find((s) => s.key === "cuenta")?.done;

  return (
    <section className="surface rise flex flex-col gap-4 p-4 sm:p-5" style={style} aria-labelledby="primeros-pasos">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Primeros pasos · {done} de {steps.length}
          </p>
          <h2 id="primeros-pasos" className="text-lg font-semibold tracking-tight">
            {allDone ? "Listo: ya tienes todo para no pagar intereses" : "No vuelvas a pagar intereses en tus tarjetas"}
          </h2>
        </div>
        <CloseStepsButton label={allDone ? "Cerrar" : "Ocultar"} />
      </div>

      {/* Avance: una barra corta en vez de un porcentaje (ley de cierre). */}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>

      {allDone ? (
        <p className="flex items-start gap-2 text-sm">
          <PartyPopper className="mt-0.5 size-4 shrink-0 text-primary" />
          Paga el monto de contado antes de la fecha límite de cada corte y no pagas intereses. Aquí abajo ves
          cuánto es, para cuándo y si tu cuenta alcanza.
        </p>
      ) : (
        <ol className="flex flex-col gap-1">
          {steps.map((step, i) => {
            const info = STEPS[step.key];
            const current = step.key === next;
            return (
              <li
                key={step.key}
                className={cn("flex items-start gap-3 rounded-lg p-2", current && "bg-muted/60")}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through")}>
                    {info.title}
                  </p>
                  {current ? <p className="text-sm text-muted-foreground">{info.hint}</p> : null}
                </div>
                {current ? (
                  <Link
                    href={info.href}
                    className={cn("shrink-0 rounded-md px-2 py-1 text-sm font-medium text-primary hover:underline", FOCUS_OUTLINE)}
                  >
                    {info.cta}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {!allDone && canSeeResult ? (
        <p className="text-sm text-muted-foreground">
          Con tu tarjeta y tu cuenta ya ves abajo cuánto pagar de contado, para cuándo y si tu cuenta alcanza.
        </p>
      ) : null}
    </section>
  );
}

/** 3.2.0 · Fase 2 (E4): la función que sigue, por un logro. Una a la vez. */
export function SuggestionCard({ suggestion, style }: { suggestion: Suggestion; style?: CSSProperties }) {
  const feature = FEATURES.find((f) => f.key === suggestion.feature)!;
  return (
    <section className="surface rise flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5" style={style}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Lightbulb className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold tracking-tight">{feature.label}</p>
        <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
      </div>
      <SuggestionActions feature={feature.key} label={feature.label} href={feature.routes[0] ?? null} />
    </section>
  );
}
