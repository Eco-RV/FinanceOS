import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import {
  financingProgress,
  financingPrepaymentPlan,
  financingSchedule,
  scheduledInterest,
  storedInstallments,
} from "./plan.ts";

const base = { months: 12, firstChargeOn: "2026-11-05", currency: "CRC" as const };

test("F1: tasa 0 conserva el reparto en partes iguales con residuo al final", () => {
  const plan = financingSchedule({ ...base, principal: 100_000, annualRatePercent: 0, months: 3 });
  assert.deepEqual(
    plan.map((c) => [c.amount, c.interest, c.principal, c.balance]),
    [
      [33_333.33, 0, 33_333.33, 66_666.67],
      [33_333.33, 0, 33_333.33, 33_333.34],
      [33_333.34, 0, 33_333.34, 0],
    ],
  );
});

test("F5: con tasa, cuota fija = interés + capital (ejemplo de la historia)", () => {
  const plan = financingSchedule({ ...base, principal: 600_000, annualRatePercent: 24 });
  assert.equal(plan.length, 12);
  assert.deepEqual(plan[0], {
    no: 1,
    of: 12,
    occurred_on: "2026-11-05",
    amount: 56_735.76,
    interest: 12_000,
    principal: 44_735.76,
    balance: 555_264.24,
  });
  assert.equal(plan.at(-1)!.balance, 0);
  const principal = plan.reduce((s, c) => s + Math.round(c.principal * 100), 0);
  assert.equal(principal, 60_000_000);
});

test("F1/F5: términos fuera de rango se rechazan", () => {
  for (const bad of [
    { principal: 0, annualRatePercent: 0 },
    { principal: 100, annualRatePercent: -1 },
    { principal: 100, annualRatePercent: 101 },
    { principal: 100, annualRatePercent: 10, months: 1 },
    { principal: 100, annualRatePercent: 10, months: 73 },
  ]) {
    assert.throws(() => financingSchedule({ ...base, ...bad }), DomainError);
  }
  assert.equal(financingSchedule({ ...base, principal: 100, annualRatePercent: 0, months: 72 }).length, 72);
});

test("M7: avance — cobradas vs. programadas, interés cobrado y por cobrar", () => {
  const plan = financingSchedule({ ...base, principal: 600_000, annualRatePercent: 24 });
  const p = financingProgress(plan, "2027-01-05");
  assert.equal(p.charged.length, 3);
  assert.equal(p.next!.no, 4);
  assert.equal(p.remainingPrincipal, 463_090.68);
  assert.equal(p.interestCharged, 12_000 + 11_105.28 + 10_192.68);
  assert.ok(Math.abs(p.interestCharged + p.interestPending - p.totalInterest) < 0.001);
  assert.ok(Math.abs(p.totalCost - 600_000 - p.totalInterest) < 0.001);
});

test("Cuotas guardadas reconstruyen el plan con su interés", () => {
  const plan = financingSchedule({ ...base, principal: 600_000, annualRatePercent: 24 });
  const rows = plan.map((c) => ({
    installment_no: c.no,
    occurred_on: c.occurred_on,
    amount: c.amount,
    interest_amount: c.interest,
  }));
  assert.deepEqual(storedInstallments(rows.reverse(), 12, 600_000), plan);
});

test("Solo el capital resta desde el día 1: interés programado por moneda", () => {
  const r = scheduledInterest(
    [
      { occurred_on: "2026-10-01", interest_amount: 100, currency: "CRC" },
      { occurred_on: "2026-11-01", interest_amount: 50.1, currency: "CRC" },
      { occurred_on: "2026-12-01", interest_amount: 25.2, currency: "CRC" },
      { occurred_on: "2026-12-01", interest_amount: 3, currency: "USD" },
      { occurred_on: "2026-12-01", interest_amount: null },
    ],
    "2026-10-14",
  );
  assert.deepEqual(r, { CRC: 75.3, USD: 3 });
});

test("F11: abono a un financiamiento con interés (baja el plazo o la cuota)", () => {
  const all = financingSchedule({
    principal: 600_000,
    annualRatePercent: 24,
    months: 12,
    firstChargeOn: "2026-11-05",
    currency: "CRC",
  });
  const pending = all.slice(3).map((c) => ({ no: c.no, occurred_on: c.occurred_on, amount: c.amount, interest: c.interest }));
  const term = financingPrepaymentPlan({ pending, annualRatePercent: 24, amount: 200_000, mode: "term" });
  assert.equal(term.capitalPending, all[2].balance);
  assert.equal(term.installments[0].no, 4);
  assert.equal(term.installments[0].occurred_on, all[3].occurred_on);
  assert.ok(term.installments.length < 9);
  const capital = term.installments.reduce((s, c) => s + Math.round(c.principal * 100), 0) / 100;
  assert.equal(Math.round((capital + 200_000) * 100) / 100, term.capitalPending);

  const pay = financingPrepaymentPlan({ pending, annualRatePercent: 24, amount: 200_000, mode: "payment" });
  assert.equal(pay.installments.length, 9);
  assert.ok(pay.installments[0].amount < all[3].amount);

  assert.equal(financingPrepaymentPlan({ pending, annualRatePercent: 24, amount: term.capitalPending, mode: "term" }).installments.length, 0);
  assert.throws(() => financingPrepaymentPlan({ pending, annualRatePercent: 24, amount: term.capitalPending + 1, mode: "term" }));
});
