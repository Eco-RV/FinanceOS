import assert from "node:assert/strict";
import { test } from "node:test";
import { displayStellarBalance, formatStellarAmount, parseStellarAmount } from "./usdc.ts";

test("K10: montos con 7 decimales", () => {
  assert.equal(parseStellarAmount("10"), BigInt(100_000_000));
  assert.equal(parseStellarAmount("12,5"), BigInt(125_000_000));
  assert.equal(parseStellarAmount("1.234,56"), BigInt(12_345_600_000));
  assert.equal(parseStellarAmount("0.0000001"), BigInt(1));
  assert.throws(() => parseStellarAmount("0"), /mayor que 0/);
  assert.throws(() => parseStellarAmount("1.12345678"), /7 decimales/);
  assert.throws(() => parseStellarAmount("abc"), /inválido/);
  assert.equal(formatStellarAmount(BigInt(125_000_000)), "12.5000000");
  assert.equal(formatStellarAmount(BigInt(1)), "0.0000001");
});

test("K10: el saldo se muestra truncado a céntimos", () => {
  assert.equal(displayStellarBalance("12.3499999"), 12.34);
  assert.equal(displayStellarBalance("0.0099999"), 0);
  assert.equal(displayStellarBalance(undefined), 0);
});
