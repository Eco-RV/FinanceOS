/**
 * Lee la respuesta de https://api.hacienda.go.cr/indicadores/tc/dolar:
 * `{ "venta": { "fecha": "2026-10-20", "valor": 453.56 }, "compra": {…} }`.
 * Devuelve el tipo de venta (T10) o `null` si el formato no es el esperado.
 * Sin dependencias, para probarlo con `node --test`.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseHaciendaRate(body: unknown): { rate_on: string; usd_crc: number } | null {
  const venta = (body as { venta?: { fecha?: unknown; valor?: unknown } } | null)?.venta;
  const fecha = typeof venta?.fecha === "string" ? venta.fecha.slice(0, 10) : "";
  const valor = Number(venta?.valor);
  if (!ISO_DATE.test(fecha) || !(Number.isFinite(valor) && valor > 0)) return null;
  return { rate_on: fecha, usd_crc: valor };
}
