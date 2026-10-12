import assert from "node:assert/strict";
import { test } from "node:test";
import type { CardStatement } from "../cards/statement.ts";
import { computeCoverage } from "./coverage.ts";
import type { LoanDue } from "../loans/loan.ts";

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
    cov.payments.map((p) => [p.kind === "card" ? p.card.name : "", p.cumulative, p.covered]),
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

const due = (over: Partial<LoanDue>): LoanDue => ({
  amount: 0,
  dueOn: "2026-10-20",
  overdue: false,
  installments: [1],
  ...over,
});

test("L6: las cuotas de préstamo entran a la cobertura junto a las tarjetas", () => {
  const today = new Date(2026, 9, 12);
  const cov = computeCoverage(
    [{ type: "checking", currency: "CRC", current_balance: 100_000 }],
    [{ card: card("Visa", "CRC"), st: st({ status: "pendiente", dueAmount: 50_000, daysToDue: 3 }) }],
    [
      // Vence en 8 días: entra en "próximos 10 días".
      { loan: "carro", currency: "CRC", remainingPrincipal: 500_000, due: due({ amount: 60_000, dueOn: "2026-10-20" }) },
      // Atrasado: va primero.
      {
        loan: "moto",
        currency: "CRC",
        remainingPrincipal: 100_000,
        due: due({ amount: 20_000, dueOn: "2026-10-01", overdue: true }),
      },
      // Sin cuota a cobro: solo resta del patrimonio.
      { loan: "casa", currency: "CRC", remainingPrincipal: 1_000_000, due: null },
    ],
    today,
  );

  assert.deepEqual(
    cov.payments.map((p) => [p.kind === "loan" ? p.loan : p.card.name, p.daysToDue, p.cumulative, p.covered]),
    [
      ["moto", -11, 20_000, true],
      ["Visa", 3, 70_000, true],
      ["carro", 8, 130_000, false],
    ],
  );
  assert.deepEqual(cov.overdue.map((p) => p.kind), ["loan"]);
  assert.equal(cov.overdueTotal, 20_000);
  assert.equal(cov.totalDue, 130_000);
  assert.equal(cov.dueSoon, 130_000);
  assert.equal(cov.coversSoon, false);
  assert.equal(cov.firstUncovered, 2);
  assert.equal(cov.netWorth, 100_000 - 1_600_000);
});

test("L6: una cuota en otra moneda se lista pero no suma", () => {
  const cov = computeCoverage(
    [{ type: "checking", currency: "CRC", current_balance: 10 }],
    [],
    [{ loan: "usd", currency: "USD", remainingPrincipal: 0, due: due({ amount: 500 }) }],
    new Date(2026, 9, 12),
  );
  assert.equal(cov.payments.length, 1);
  assert.equal(cov.totalDue, 0);
  assert.equal(cov.payments[0].covered, true);
});
