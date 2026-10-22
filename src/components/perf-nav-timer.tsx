"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 3.2.0 · Fase 1.1: mide cuánto tarda una navegación desde el toque hasta que
 * se ve la página. Solo se activa con `localStorage.setItem("fo-perf", "1")`
 * (o `NEXT_PUBLIC_PERF_LOG=1`); si no, no hace nada.
 *
 * - `shell`: desde el toque hasta que cambia la ruta (esqueleto de carga).
 * - `content`: hasta que ya no queda ningún esqueleto (`[aria-busy="true"]`).
 *
 * Cada medición sale en la consola (`[perf] nav …`) y se guarda en
 * `window.__foPerf`.
 */
type NavSample = { from: string; to: string; shell: number; content: number };

declare global {
  interface Window {
    __foPerf?: NavSample[];
  }
}

function enabled(): boolean {
  if (process.env.NEXT_PUBLIC_PERF_LOG === "1") return true;
  try {
    return window.localStorage.getItem("fo-perf") === "1";
  } catch {
    return false;
  }
}

export function PerfNavTimer() {
  const pathname = usePathname();
  const search = useSearchParams();
  const route = `${pathname}${search.size ? `?${search}` : ""}`;
  const pending = useRef<{ from: string; to: string; t0: number } | null>(null);
  const last = useRef(route);

  // Toque en un enlace interno: arranca el reloj.
  useEffect(() => {
    if (!enabled()) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin) return;
      const to = `${a.pathname}${a.search}`;
      if (to === `${window.location.pathname}${window.location.search}`) return;
      pending.current = { from: last.current, to, t0: performance.now() };
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Cambió la ruta: se pintó el esqueleto; espera a que se vaya.
  useEffect(() => {
    last.current = route;
    const nav = pending.current;
    if (!nav) return;
    pending.current = null;
    let shell = 0;
    requestAnimationFrame(() => {
      shell = Math.round(performance.now() - nav.t0);
      const done = () => {
        const content = Math.round(performance.now() - nav.t0);
        const sample = { from: nav.from, to: route, shell, content };
        (window.__foPerf ??= []).push(sample);
        console.info(`[perf] nav ${nav.from} → ${route} shell=${shell}ms content=${content}ms`);
      };
      if (!document.querySelector('[aria-busy="true"]')) return done();
      const observer = new MutationObserver(() => {
        if (document.querySelector('[aria-busy="true"]')) return;
        observer.disconnect();
        requestAnimationFrame(done);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // Si algo queda cargando para siempre, no medir de más.
      setTimeout(() => observer.disconnect(), 15000);
    });
  }, [route]);

  return null;
}
