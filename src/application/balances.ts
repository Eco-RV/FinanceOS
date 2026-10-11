/** Verificación de saldos: la proyección guardada vs. los movimientos (G1). */

import { findBalanceDrift, type BalanceDrift } from "../domain/index.ts";
import type { BalanceRepository } from "./ports.ts";
import { ok, run, type UseCaseResult } from "./result.ts";

export function checkBalances(
  deps: { balances: BalanceRepository },
): Promise<UseCaseResult<{ checked: number; drift: BalanceDrift[] }>> {
  return run(async () => {
    const [stored, movements] = await Promise.all([
      deps.balances.stored(),
      deps.balances.movements(),
    ]);
    return ok({ checked: stored.length, drift: findBalanceDrift(stored, movements) });
  });
}

export function recomputeBalances(
  deps: { balances: BalanceRepository },
): Promise<UseCaseResult<{ changed: number }>> {
  return run(async () => ok({ changed: await deps.balances.recompute() }));
}
