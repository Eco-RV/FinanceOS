import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tryFormat } from "./try-format.ts";

const fixture = readFileSync(new URL("./fixtures/bac-compra.html", import.meta.url), "utf8");

test("Probar formato: el aviso del BAC se entiende", () => {
  const r = tryFormat("bac", fixture);
  assert.ok(r.ok);
  assert.equal(r.parsed.merchant, "WALMART GUADALUPE WCN0");
  assert.equal(r.parsed.amount, 22_920);
});

test("Probar formato: si cambia una etiqueta, muestra lo que sí encontró", () => {
  const r = tryFormat("bac", fixture.replace("Monto:", "Importe:"));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.reason, /no reconoci/);
    assert.ok(r.labels.some((l) => l.startsWith("importe:")));
  }
});

test("Probar formato: un reverso se explica", () => {
  const r = tryFormat("bac", fixture.replace(">COMPRA<", ">REVERSO<"));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /no de una compra/);
});

test("Probar formato: el mismo aviso como texto (Outlook sin HTML) también se entiende", () => {
  const text = [
    "Comercio:", "WALMART GUADALUPE WCN0",
    "Fecha:", "Oct 4, 2026, 18:38",
    "AMEX:", "***********8258",
    "Tipo de Transacción:", "COMPRA",
    "Monto:", "CRC 22,920.00",
  ].join("\n");
  const r = tryFormat("bac", text);
  assert.ok(r.ok);
  assert.equal(r.parsed.lastFour, "8258");
});
