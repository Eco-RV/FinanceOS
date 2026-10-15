import "server-only";

import { headers } from "next/headers";

/**
 * Origen público de la app para los enlaces que manda Supabase por correo
 * (confirmar registro, cambiar correo, restablecer contraseña). Sale del
 * request (Vercel envía `x-forwarded-host`), así que en producción apunta a
 * producción y en local a localhost. `NEXT_PUBLIC_SITE_URL` lo fija a mano.
 */
export async function siteOrigin(): Promise<string> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Enlace de `/auth/confirm` que vuelve a `next` (ruta interna) al confirmar. */
export async function confirmUrl(next: string): Promise<string> {
  return `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(safeNext(next))}`;
}

/** Solo rutas internas ("/algo"), nunca otro dominio ("//x.com", "https://…"). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
