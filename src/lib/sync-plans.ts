import "server-only";

import { cache } from "react";
import { crToday, toISODate } from "@/domain";
import { syncPlans } from "@/application";
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
