/** Tipo de cambio manual (T2): colones por dólar, digitado por el usuario. */

import { validateExchangeRate, type ExchangeRate } from "../domain/index.ts";
import type { ExchangeRateRepository } from "./ports.ts";
import { ok, run, type UseCaseResult } from "./result.ts";

export function setExchangeRate(
  deps: { exchangeRates: ExchangeRateRepository },
  rate: ExchangeRate,
): Promise<UseCaseResult> {
  return run(async () => {
    validateExchangeRate(rate.usd_crc);
    await deps.exchangeRates.save(rate);
    return ok();
  });
}
