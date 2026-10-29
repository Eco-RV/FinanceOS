import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { DATE_FORMATS, readPreferences } from "@/domain";
import { repositories } from "@/infrastructure/container";
import { DATE_FORMAT_COOKIE, setRequestDateFormat, type DateFormatChoice } from "@/lib/format";

/**
 * Perfil del usuario, una vez por request. Sin el SQL 2.6.0 o sin sesión
 * devuelve `null`.
 */
export const getProfile = cache(async () => {
  try {
    return await (await repositories()).profiles.get();
  } catch {
    return null;
  }
});

/** U9 (3.1.0): preferencias guardadas en el perfil, una vez por request. */
export const getPreferences = cache(async () => readPreferences((await getProfile())?.preferences));

/** Preferencias tal cual se guardaron, para lectores propios de cada módulo (p. ej. I7). */
export const getPreferencesRaw = cache(async () => (await getProfile())?.preferences ?? null);

/**
 * U9 · 3.2.0: formato de fecha de este request para `formatDate` en server
 * components. Sale de la cookie `fo-date` (sin consulta a la base, para no
 * sumar una tanda a cada página); la guarda la acción de Preferencias y la
 * corrige `DateFormatProvider` en el navegador si no coincide con el perfil.
 * `requireUser()` lo espera.
 */
export const loadRequestDateFormat = cache(async () => {
  try {
    const value = (await cookies()).get(DATE_FORMAT_COOKIE)?.value;
    if ((DATE_FORMATS as readonly string[]).includes(value ?? "")) setRequestDateFormat(value as DateFormatChoice);
  } catch {
    // Fuera de un request: queda "corto".
  }
});
