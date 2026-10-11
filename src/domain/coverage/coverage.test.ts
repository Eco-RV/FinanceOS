import assert from "node:assert/strict";
import { test } from "node:test";
import type { CardStatement } from "../cards/statement.ts";
import { computeCoverage } from "./coverage.ts";

const st = (over: Partial<CardStatement>): CardStatement => ({
  lastCutoff: new Date(2026, 8, 15),
  dueDate: new Date(2026, 9, 5),
  statementBalance: 0,
  paidAfterCutoff: 0,
  dueAmount: 0,
  newCharges: 0,
  balanceByMovements: 0,
  status: "sin-saldo",
  daysToDue: 0,
  ...over,
});

const card = (name: string, currency: string, current_balance = 0) => ({
  name,
  currency,
  current_balance,
});

test("cobertura acumulada del más urgente al de más tiempo, solo CRC", () => {
  const cov = computeCoverage(
    [
      { type: "checking", currency: "CRC", current_balance: 100_000 },
      { type: "savings", currency: "CRC", current_balance: 900_000 }, // no cuenta
      { type: "checking", currency: "USD", current_balance: 50 }, // no cuenta
    ],
    [
      { card: card("B", "CRC"), st: st({ status: "pendiente", dueAmount: 70_000, daysToDue: 20 }) },
      { card: card("A", "CRC"), st: st({ status: "atrasada", dueAmount: 60_000, daysToDue: -2 }) },
      { card: card("U", "USD"), st: st({ status: "pendiente", dueAmount: 30, daysToDue: 5 }) },
      { card: card("Z", "CRC"), st: st({ status: "al-dia", newCharges: 8_000 }) },
    ],
  );

  assert.equal(cov.availableDebit, 100_000);
  assert.deepEqual(
    cov.payments.map((p) => [p.card.name, p.cumulative, p.covered]),
    [
      ["A", 60_000, true],
      ["U", 60_000, true],
      ["B", 130_000, false],
    ],
  );
  assert.equal(cov.firstUncovered, 2);
  assert.equal(cov.overdueTotal, 60_000);
  assert.equal(cov.totalDue, 130_000);
  assert.equal(cov.dueSoon, 60_000);
  assert.equal(cov.newCharges, 8_000);
  assert.equal(cov.coversSoon, true);
  assert.equal(cov.coverageRatio, 0.6);
});

test("sin débito y con pagos próximos, la cobertura es total (ratio 1)", () => {
  const cov = computeCoverage(
    [],
    [{ card: card("A", "CRC"), st: st({ status: "pendiente", dueAmount: 10, daysToDue: 1 }) }],
  );
  assert.equal(cov.coverageRatio, 1);
  assert.equal(cov.coversSoon, false);
});
