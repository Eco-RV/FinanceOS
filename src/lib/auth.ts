import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRequestDateFormat } from "@/lib/preferences";

/**
 * Lo que una página necesita saber de la sesión. `isAdmin` (3.2.0, buzón de
 * comentarios) sale de `app_metadata.role = "admin"`, que el usuario no puede
 * cambiar (ver `supabase/Versionamiento/3.2.0/02_feedback_admin.sql`).
 */
export type SessionUser = { id: string; email: string | null; isAdmin: boolean };

/**
 * Usuario de la sesión (o null), una vez por request.
 *
 * 3.2.0 · Fase 1.2: usa `getClaims()`, que valida el JWT en el servidor sin ir
 * a Supabase Auth cuando el proyecto firma con llaves asimétricas (JWT Signing
 * Keys); con la llave compartida de antes, `getClaims()` consulta a Auth como
 * hacía `getUser()`. Para datos que no van en el token (fecha de alta, último
 * ingreso) usar `getAuthUser()`.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) return null;
    const role = (claims.app_metadata as { role?: unknown } | undefined)?.role;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null, isAdmin: role === "admin" };
  } catch {
    // Supabase not configured yet, or auth service unreachable.
    return null;
  }
});

/** Usuario completo de Supabase Auth (siempre consulta a Auth). Solo donde hace falta. */
export const getAuthUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

/**
 * Returns the current user or redirects to /login. Use in protected pages/actions.
 * 3.2.0: también fija el formato de fecha del request (cookie, sin consulta)
 * antes de que la página pinte nada.
 */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const [user] = await Promise.all([getUser(), loadRequestDateFormat()]);
  if (!user) redirect("/login");
  return user;
});
