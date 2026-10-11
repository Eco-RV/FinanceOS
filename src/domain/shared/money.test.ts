import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "./errors.ts";
import {
  add,
  amountOf,
  assertSameCurrency,
  convert,
  money,
  splitEvenly,
  sum,
  toCents,
} from "./money.ts";

test("trabaja en céntimos enteros (sin error de punto flotante)", () => {
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(amountOf(add(money(0.1, "CRC"), money(0.2, "CRC"))), 0.3);
});

test("G3: no suma monedas distintas", () => {
  assert.throws(() => add(money(1, "CRC"), money(1, "USD")), (e: unknown) => {
    return e instanceof DomainError && e.rule === "G3";
  });
  assert.throws(() => assertSameCurrency("CRC", "USD", "M5"), /CRC y USD/);
});

test("sum de una lista vacía es 0 en la moneda pedida", () => {
  assert.deepEqual(sum([], "USD"), { cents: 0, currency: "USD" });
});

test("splitEvenly: el residuo va a la última parte y la suma cierra", () => {
  const parts = splitEvenly(money(100, "CRC"), 3);
  assert.deepEqual(parts.map(amountOf), [33.33, 33.33, 33.34]);
  assert.equal(sum(parts, "CRC").cents, 10000);
});

test("splitEvenly rechaza partes inválidas", () => {
  assert.throws(() => splitEvenly(money(10, "CRC"), 0), DomainError);
});

test("convert usa un tipo de cambio explícito", () => {
  assert.deepEqual(convert(money(10, "USD"), "CRC", 505.5), { cents: 505500, currency: "CRC" });
  assert.throws(() => convert(money(10, "USD"), "CRC", 0), DomainError);
});
