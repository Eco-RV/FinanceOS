"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

/** Saludo según la hora de Costa Rica (UTC-6, sin horario de verano). */
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Costa_Rica",
    }).format(new Date()),
  );
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Bienvenida (2.5.0): al abrir la app (carga completa, también con sesión
 * iniciada) cubre la pantalla con el logo animado, el saludo y una barra de
 * carga; luego se desvanece. Al navegar dentro de la app no vuelve a salir
 * porque el layout se conserva. Tocarla la cierra.
 */
export function WelcomeSplash() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? 500 : 1500;
    const t1 = window.setTimeout(() => setPhase("out"), hold);
    const t2 = window.setTimeout(() => setPhase("gone"), hold + 450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      role="presentation"
      onClick={() => setPhase("gone")}
      className={cn(
        "fixed inset-0 z-[70] grid place-items-center bg-background transition-[opacity,filter] duration-450 ease-fluid",
        phase === "out" ? "pointer-events-none opacity-0 blur-sm" : "opacity-100",
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <span className="relative grid size-20 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-2xl">
          <LogoMark animated className="size-12" />
        </span>
        <div className="flex flex-col items-center gap-1 text-center rise" style={{ ["--rise-i" as string]: 5 }}>
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {greeting()}
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            Bienvenido a Finance<span className="text-muted-foreground"> OS</span>
          </p>
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div
            data-motion
            className="h-full origin-left rounded-full bg-foreground/80"
            style={{ animation: "splash-bar 1300ms var(--ease-fluid) 150ms both" }}
          />
        </div>
      </div>
    </div>
  );
}
