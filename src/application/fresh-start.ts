/** Caso de uso del Arranque de 0 (M8). */

import { planFreshStart, type FreshStartOpening, type ISODate } from "../domain/index.ts";
import type { FreshStartRepository } from "./ports.ts";
import { ok, run, type UseCaseResult } from "./result.ts";

export type FreshStartInput = {
  confirmation: string;
  todayISO: ISODate;
  /** Fecha de los saldos iniciales nuevos. */
  on: ISODate;
  openings: FreshStartOpening[];
};

/**
 * Valida contra las cuentas y tarjetas activas de este momento (M8) y deja
 * que la persistencia haga el arranque completo en una sola transacción.
 */
export function freshStart(
  deps: { freshStart: FreshStartRepository },
  input: FreshStartInput,
): Promise<UseCaseResult<{ archived: number; openings: number }>> {
  return run(async () => {
    const plan = planFreshStart({
      confirmation: input.confirmation,
      products: await deps.freshStart.activeProducts(),
      openings: input.openings,
    });
    const archived = await deps.freshStart.run(input.todayISO, input.on, plan);
    return ok({ archived, openings: plan.length });
  });
}
