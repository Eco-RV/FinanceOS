/**
 * Tipo de cambio de referencia del BCCR (venta) desde la API pública del
 * Ministerio de Hacienda (3.1.0, T10). Sin token. Ver
 * https://api.hacienda.go.cr/indicadores/tc/dolar
 */

import { InfrastructureError, type ExchangeRateSource } from "@/application";
import { parseHaciendaRate } from "./hacienda-parse";

const URL = "https://api.hacienda.go.cr/indicadores/tc/dolar";

export const haciendaExchangeRate: ExchangeRateSource = {
  async today() {
    let body: unknown;
    try {
      const res = await fetch(URL, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(String(res.status));
      body = await res.json();
    } catch {
      throw new InfrastructureError("No se pudo consultar el tipo de cambio del BCCR: inténtalo más tarde");
    }
    const rate = parseHaciendaRate(body);
    if (!rate) throw new InfrastructureError("La respuesta del tipo de cambio no tiene el formato esperado");
    return rate;
  },
};
