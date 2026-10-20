import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHaciendaRate } from "./hacienda-parse.ts";

test("T10: lee la venta de la respuesta de Hacienda", () => {
  // Respuesta real de api.hacienda.go.cr/indicadores/tc/dolar (2026-10-20).
  const body = { venta: { fecha: "2026-10-20", valor: 453.56 }, compra: { fecha: "2026-10-20", valor: 448.07 } };
  assert.deepEqual(parseHaciendaRate(body), { rate_on: "2026-10-20", usd_crc: 453.56 });
  // Fecha con hora o valor como texto también sirven.
  assert.deepEqual(parseHaciendaRate({ venta: { fecha: "2026-10-20T00:00:00", valor: "453.56" } }), {
    rate_on: "2026-10-20",
    usd_crc: 453.56,
  });
});

test("T10: un formato inesperado no se acepta", () => {
  assert.equal(parseHaciendaRate(null), null);
  assert.equal(parseHaciendaRate({}), null);
  assert.equal(parseHaciendaRate({ venta: { fecha: "20/10/2026", valor: 453 } }), null);
  assert.equal(parseHaciendaRate({ venta: { fecha: "2026-10-20", valor: 0 } }), null);
});
