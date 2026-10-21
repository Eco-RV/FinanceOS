import "server-only";

import { cache } from "react";
import { readPreferences } from "@/domain";
import { repositories } from "@/infrastructure/container";
import { setRequestDateFormat } from "@/lib/format";

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

/**
 * U9 (3.1.0) · 3.2.0: preferencias del usuario, una vez por request. Además
 * fija el formato de fecha del request, así todo lo que se pinta después
 * (`formatDate` en server components) usa el del usuario. `requireUser()` lo
 * espera en paralelo con la sesión.
 */
export const getPreferences = cache(async () => {
  const prefs = readPreferences((await getProfile())?.preferences);
  setRequestDateFormat(prefs.dateFormat);
  return prefs;
});
