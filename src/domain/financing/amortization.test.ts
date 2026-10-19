import assert from "node:assert/strict";
import { test } from "node:test";
import { frenchAmortization, remainingTerm, segmentedAmortization } from "./amortization.ts";

const base = { principal: 600_000, annualRatePercent: 24, months: 12, firstChargeOn: "2026-11-05" };
const sumPrincipal = (rows: { principal: number }[]) =>
  Math.round(rows.reduce((s, r) => s + r.principal * 100, 0)) / 100;

test("sin eventos es la tabla francesa de siempre", () => {
  assert.deepEqual(segmentedAmortization(base), frenchAmortization(base));
});

test("remainingTerm: cuotas que faltan con una cuota dada", () => {
  assert.equal(remainingTerm(600_000, 0.02, 56_735.76), 12);
  assert.equal(remainingTerm(100, 0, 30), 4);
  assert.equal(remainingTerm(0, 0.02, 10), 0);
  assert.equal(remainingTerm(100_000, 0.02, 1_000), null);
});

test("L7/F11: abono que baja el plazo conserva la cuota y termina antes", () => {
  const s = segmentedAmortization({
    ...base,
    events: [{ kind: "prepayment", afterNo: 3, amount: 200_000, mode: "term" }],
  });
  const plain = frenchAmortization(base);
  assert.deepEqual(s.rows.slice(0, 3), plain.rows.slice(0, 3));
  assert.ok(s.rows.length < 12);
  // La cuota 4 sigue siendo (casi) la misma.
  assert.ok(Math.abs(s.rows[3].payment - plain.payment) < 1);
  // El capital de las cuotas + el abono = el préstamo.
  assert.equal(sumPrincipal(s.rows) + 200_000, 600_000);
  assert.equal(s.rows.at(-1)!.balance, 0);
  assert.ok(s.totalInterest < plain.totalInterest);
  // Fechas: mismo día cada mes.
  assert.equal(s.rows[3].occurred_on, "2027-02-05");
});

test("L7/F11: abono que baja la cuota conserva el plazo", () => {
  const s = segmentedAmortization({
    ...base,
    events: [{ kind: "prepayment", afterNo: 3, amount: 200_000, mode: "payment" }],
  });
  assert.equal(s.rows.length, 12);
  assert.ok(s.rows[3].payment < s.rows[2].payment);
  assert.equal(sumPrincipal(s.rows) + 200_000, 600_000);
  assert.equal(s.rows.at(-1)!.balance, 0);
});

test("un abono por todo lo que falta cierra el préstamo", () => {
  const plain = frenchAmortization(base);
  const s = segmentedAmortization({
    ...base,
    events: [{ kind: "prepayment", afterNo: 2, amount: plain.rows[1].balance + 1_000, mode: "term" }],
  });
  assert.equal(s.rows.length, 2);
});

test("L8: tasa variable desde una cuota, mismo plazo", () => {
  const s = segmentedAmortization({ ...base, events: [{ kind: "rate", fromNo: 7, annualRatePercent: 12 }] });
  assert.equal(s.rows.length, 12);
  assert.ok(s.rows[6].payment < s.rows[5].payment);
  assert.ok(Math.abs(s.rows[6].interest - s.rows[5].balance * 0.01) < 0.01);
  assert.equal(sumPrincipal(s.rows), 600_000);
});
