import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseBac } from "./bac.ts";
import { parseAmount } from "../html.ts";

const html = readFileSync(
  new URL("./fixtures/bac-compra.html", import.meta.url),
  "utf8",
);

const base = {
  id: "m1",
  from: "NotificacionBAC@baccredomatic.cr",
  subject: "Notificación de transacción WALMART GUADALUPE WCN0 04-10-2026 - 18:38",
  html,
  text: null,
};

test("BAC: compra en colones", () => {
  assert.deepEqual(parseBac(base), {
    merchant: "WALMART GUADALUPE WCN0",
    amount: 22920,
    currency: "CRC",
    occurredOn: "2026-10-04",
    lastFour: "8258",
    authorization: "555685",
    reference: "44717676",
  });
});

test("BAC: compra en dólares", () => {
  const usd = html.replace("CRC 22,920.00", "USD 12.50");
  const r = parseBac({ ...base, html: usd });
  assert.equal(r?.currency, "USD");
  assert.equal(r?.amount, 12.5);
});

test("BAC: la marca de la tarjeta no importa (VISA)", () => {
  const visa = html.replace("AMEX:", "VISA:").replace("8258", "0042");
  assert.equal(parseBac({ ...base, html: visa })?.lastFour, "0042");
});

test("BAC: fecha de respaldo desde el asunto", () => {
  const noDate = html.replace("Oct 4, 2026, 18:38", "no disponible");
  assert.equal(parseBac({ ...base, html: noDate })?.occurredOn, "2026-10-04");
});

test("BAC: ignora lo que no es COMPRA", () => {
  const reverso = html.replace("COMPRA", "REVERSO");
  assert.equal(parseBac({ ...base, html: reverso }), null);
});

test("BAC: formato desconocido devuelve null", () => {
  assert.equal(parseBac({ ...base, html: "<p>hola</p>" }), null);
  assert.equal(parseBac({ ...base, html: null, text: null }), null);
});

test("parseAmount: separadores", () => {
  assert.equal(parseAmount("CRC 22,920.00"), 22920);
  assert.equal(parseAmount("22.920,00"), 22920);
  assert.equal(parseAmount("22920"), 22920);
  assert.equal(parseAmount("1,234,567.89"), 1234567.89);
  assert.equal(parseAmount("abc"), null);
});
