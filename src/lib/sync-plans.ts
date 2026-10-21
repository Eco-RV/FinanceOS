import "server-only";

import { cache } from "react";
import { crToday, toISODate } from "@/domain";
import { refreshExchangeRate, syncPlans } from "@/application";
import { repositories } from "@/infrastructure/container";
import { timed } from "@/lib/perf";

/**
 * M7 (2.7.0): registra las ocurrencias de los planes que ya llegaron. Una vez
 * por request (layout y página la piden; se ejecuta una sola vez). Nunca
 * rompe la página: sin el SQL 2.7.0 no hace nada.
 */
export const ensurePlansUpToDate = cache(async (): Promise<number> =>
  timed("sync:planes", async () => {
    try {
      const { plans } = await repositories();
      const result = await syncPlans(plans, toISODate(crToday()));
      return result.ok ? result.value.registered : 0;
    } catch {
      return 0;
    }
  }),
);

/**
 * T10 (3.1.0): trae el tipo de cambio de hoy del BCCR (vía Hacienda) si el
 * último guardado es de otro día. Una vez por request y nunca rompe la
 * página: si la API no responde, se sigue con el último guardado.
 */
export const ensureExchangeRateToday = cache(async (): Promise<void> =>
  timed("sync:tipo-cambio", async () => {
    try {
      const repos = await repositories();
      await refreshExchangeRate(repos, { today: toISODate(crToday()) });
    } catch {
      // Sin red o sin sesión: queda el último tipo de cambio.
    }
  }),
);
