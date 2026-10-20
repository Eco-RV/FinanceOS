import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import { minimumPaymentStatus, validateMinimumPayment } from "./minimum.ts";

const rule = (id: string) => (e: unknown) => e instanceof DomainError && e.rule === id;

test("T8: el mínimo es ≥ 0 y no pasa el saldo al corte", () => {
  assert.doesNotThrow(() => validateMinimumPayment(12_500, 250_000));
  assert.doesNotThrow(() => validateMinimumPayment(0, 0));
  assert.throws(() => validateMinimumPayment(-1, 100), rule("T8"));
  assert.throws(() => validateMinimumPayment(100.01, 100), rule("T8"));
});

test("T8: cuánto falta para cubrir el mínimo con lo abonado después del corte", () => {
  assert.deepEqual(minimumPaymentStatus(12_500, 5_000), { minimum: 12_500, remaining: 7_500, covered: false });
  assert.deepEqual(minimumPaymentStatus(12_500, 20_000), { minimum: 12_500, remaining: 0, covered: true });
  assert.equal(minimumPaymentStatus(0.3, 0.1).remaining, 0.2);
});
