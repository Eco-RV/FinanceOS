/**
 * Tipo de cambio (T2): colones por dólar. Se digita a mano o, desde 3.0.1
 * (T10), se trae del BCCR (vía la API pública de Hacienda) una vez al día.
 */

import { validateExchangeRate, type ExchangeRate, type ISODate } from "../domain/index.ts";
import type { ExchangeRateRepository, ExchangeRateSource } from "./ports.ts";
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

/**
 * T10: trae el tipo de cambio de hoy de la fuente oficial y lo guarda. Si ya
 * hay uno con fecha de hoy (o posterior) no consulta, salvo `force`. Un
 * tipo digitado a mano para hoy se respeta (no se pisa sin `force`).
 */
export function refreshExchangeRate(
  deps: { exchangeRates: ExchangeRateRepository; exchangeRateSource: ExchangeRateSource },
  input: { today: ISODate; force?: boolean },
): Promise<UseCaseResult<{ rate: ExchangeRate; fetched: boolean }>> {
  return run<{ rate: ExchangeRate; fetched: boolean }>(async () => {
    const latest = await deps.exchangeRates.latest();
    if (!input.force && latest && latest.rate_on >= input.today) return ok({ rate: latest, fetched: false });
    const rate = await deps.exchangeRateSource.today();
    validateExchangeRate(rate.usd_crc);
    await deps.exchangeRates.save(rate);
    return ok({ rate, fetched: true });
  });
}
