import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import { frenchAmortization } from "./amortization.ts";
import { financingCancellation, installmentSchedule, splitByDate } from "./installments.ts";

test("F1/F2: cuotas tasa 0 cierran al total y respetan meses cortos", () => {
  const plan = installmentSchedule({
    totalAmount: 100_000,
    months: 3,
    firstChargeOn: "2026-01-31",
    currency: "CRC",
  });
  assert.deepEqual(
    plan.map((c) => [c.no, c.occurred_on, c.amount]),
    [
      [1, "2026-01-31", 33_333.33],
      [2, "2026-02-28", 33_333.33],
      [3, "2026-03-31", 33_333.34],
    ],
  );
});

test("F1: meses fuera de rango se rechazan", () => {
  assert.throws(
    () =>
      installmentSchedule({ totalAmount: 10, months: 1, firstChargeOn: "2026-01-01", currency: "CRC" }),
    DomainError,
  );
});

test("M7: separa cuotas ocurridas de programadas", () => {
  const { occurred, scheduled } = splitByDate(
    [{ occurred_on: "2026-10-01" }, { occurred_on: "2026-10-11" }, { occurred_on: "2026-11-01" }],
    "2026-10-11",
  );
  assert.equal(occurred.length, 2);
  assert.equal(scheduled.length, 1);
});

test("F5: amortización francesa — ejemplo de la historia de usuario", () => {
  const t = frenchAmortization({
    principal: 600_000,
    annualRatePercent: 24,
    months: 12,
    firstChargeOn: "2026-11-05",
  });
  assert.equal(t.payment, 56_735.76);
  assert.deepEqual(t.rows[0], {
    no: 1,
    occurred_on: "2026-11-05",
    payment: 56_735.76,
    interest: 12_000,
    principal: 44_735.76,
    balance: 555_264.24,
  });
  assert.equal(t.rows[1].interest, 11_105.28);
  assert.equal(t.rows.at(-1)!.balance, 0);
  assert.equal(t.rows.at(-1)!.occurred_on, "2027-10-05");
  // La suma de abonos al capital cierra exacto al capital.
  const principalSum = t.rows.reduce((s, r) => s + Math.round(r.principal * 100), 0);
  assert.equal(principalSum, 60_000_000);
  assert.ok(Math.abs(t.totalInterest - 80_829.1) < 0.05);
});

test("F5: tasa 0 equivale a cuotas iguales", () => {
  const t = frenchAmortization({
    principal: 1200,
    annualRatePercent: 0,
    months: 12,
    firstChargeOn: "2026-01-01",
  });
  assert.equal(t.payment, 100);
  assert.equal(t.totalInterest, 0);
});

test("F4: cancelar conserva las cuotas con fecha ≤ hoy", () => {
  const plan = installmentSchedule({
    totalAmount: 90_000,
    months: 3,
    firstChargeOn: "2026-09-15",
    currency: "CRC",
  });
  const r = financingCancellation(plan, "2026-10-15");
  assert.deepEqual(r.keep.map((c) => c.no), [1, 2]);
  assert.deepEqual(r.remove.map((c) => c.no), [3]);
  assert.equal(r.deletePlan, false);
  assert.equal(financingCancellation(plan, "2026-09-14").deletePlan, true);
});
