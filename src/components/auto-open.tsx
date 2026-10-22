"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 3.2.0: abre al llegar el diálogo que envuelve (p. ej. "Nueva tarjeta" con
 * `/procesos/tarjetas?nueva=1`, desde los primeros pasos o un estado vacío).
 * Toca su propio botón, así corre la misma lógica de apertura que con un
 * toque, y quita el parámetro de la URL sin volver a pedir la página (un
 * recargar no lo reabre).
 */
export function AutoOpen({ when, param, children }: { when: boolean; param: string; children: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
  // En desarrollo (StrictMode) el efecto corre dos veces: un segundo toque lo cerraría.
  const opened = useRef(false);

  useEffect(() => {
    if (!when || opened.current) return;
    opened.current = true;
    wrapper.current?.querySelector("button")?.click();
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [when, param]);

  return (
    <div ref={wrapper} className="contents">
      {children}
    </div>
  );
}
