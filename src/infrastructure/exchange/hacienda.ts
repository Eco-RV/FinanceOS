/**
 * Tipo de cambio de referencia del BCCR (venta) desde la API pública del
 * Ministerio de Hacienda (3.0.1, T10). Sin token. Ver
 * https://api.hacienda.go.cr/indicadores/tc/dolar
 */

import { InfrastructureError, type ExchangeRateSource } from "@/application";

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
    const venta = (body as { venta?: { fecha?: string; valor?: number } }).venta;
    if (!venta?.fecha || !/^d{4}-d{2}-d{2}$/.test(venta.fecha) || !(Number(venta.valor) > 0)) {
      throw new InfrastructureError("La respuesta del tipo de cambio no tiene el formato esperado");
    }
    return { rate_on: venta.fecha, usd_crc: Number(venta.valor) };
  },
};
