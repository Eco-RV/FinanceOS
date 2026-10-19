import "server-only";

import { cache } from "react";
import { crToday, toISODate } from "@/domain";
import { refreshExchangeRate, syncPlans } from "@/application";
import { repositories } from "@/infrastructure/container";

/**
 * M7 (2.7.0): registra las ocurrencias de los planes que ya llegaron. Una vez
 * por request (layout y página la piden; se ejecuta una sola vez). Nunca
 * rompe la página: sin el SQL 2.7.0 no hace nada.
 */
export const ensurePlansUpToDate = cache(async (): Promise<number> => {
  try {
    const { plans } = await repositories();
    const result = await syncPlans(plans, toISODate(crToday()));
    return result.ok ? result.value.registered : 0;
  } catch {
    return 0;
  }
});

/**
 * T10 (3.0.1): trae el tipo de cambio de hoy del BCCR (vía Hacienda) si el
 * último guardado es de otro día. Una vez por request y nunca rompe la
 * página: si la API no responde, se sigue con el último guardado.
 */
export const ensureExchangeRateToday = cache(async (): Promise<void> => {
  try {
    const repos = await repositories();
    await refreshExchangeRate(repos, { today: toISODate(crToday()) });
  } catch {
    // Sin red o sin sesión: queda el último tipo de cambio.
  }
});
