import "server-only";

import { cache } from "react";
import { after } from "next/server";
import { headers } from "next/headers";

/**
 * 3.2.0 · Fase 1.1: mide en el servidor cuánto tarda cada paso de un render
 * (sesión, perfil, sincronizaciones y cada consulta a Supabase). Solo con
 * `PERF_LOG=1`; sin la variable no hace nada. Al terminar la respuesta deja
 * una línea por request en el log:
 *
 *   [perf] /dashboard total=812ms | auth 95ms @0 · db:accounts 61ms @97 · …
 *
 * `@n` es cuándo empezó el paso (ms desde el primero), para ver qué corre en
 * paralelo y qué en cascada. La ruta la pone el proxy en `x-fo-path`.
 */
export const PERF_ENABLED = process.env.PERF_LOG === "1";

type Mark = { label: string; ms: number; at: number };

const requestTimings = cache(() => {
  const store = {
    t0: performance.now(),
    marks: [] as Mark[],
    // En un server component no se puede leer `headers()` dentro de `after`.
    path: headers()
      .then((h) => h.get("x-fo-path") ?? "?")
      .catch(() => "?"),
  };
  after(async () => {
    if (store.marks.length === 0) return;
    const path = await store.path;
    const total = Math.round(performance.now() - store.t0);
    const steps = [...store.marks]
      .sort((a, b) => a.at - b.at)
      .map((m) => `${m.label} ${m.ms}ms @${m.at}`)
      .join(" · ");
    console.log(`[perf] ${path} total=${total}ms | ${steps}`);
  });
  return store;
});

function record(label: string, start: number) {
  const store = requestTimings();
  store.marks.push({
    label,
    ms: Math.round(performance.now() - start),
    at: Math.round(start - store.t0),
  });
}

/** Mide `work` con la etiqueta `label` (sin `PERF_LOG=1`, solo lo ejecuta). */
export async function timed<T>(label: string, work: () => Promise<T>): Promise<T> {
  if (!PERF_ENABLED) return work();
  requestTimings();
  const start = performance.now();
  try {
    return await work();
  } finally {
    record(label, start);
  }
}

/** Nombre corto de una llamada a Supabase: `db:accounts`, `rpc:fresh_start`, `auth:user`. */
function supabaseLabel(input: RequestInfo | URL, init?: RequestInit): string {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const rest = url.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/);
  if (rest) return `rpc:${rest[1]}`;
  const table = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
  if (table) return `db:${table[1]}${method === "GET" || method === "HEAD" ? "" : `:${method.toLowerCase()}`}`;
  const auth = url.pathname.match(/\/auth\/v1\/([^/?]+)/);
  if (auth) return `auth:${auth[1]}`;
  const storage = url.pathname.match(/\/storage\/v1\/([^/?]+)/);
  if (storage) return `storage:${storage[1]}`;
  return url.pathname;
}

/** `fetch` para el cliente de Supabase que mide cada consulta (solo con `PERF_LOG=1`). */
export const timedFetch: typeof fetch = async (input, init) => {
  requestTimings();
  const start = performance.now();
  try {
    return await fetch(input, init);
  } finally {
    record(supabaseLabel(input, init), start);
  }
};
