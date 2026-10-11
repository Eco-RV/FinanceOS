import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import {
  balanceEffects,
  deriveBalances,
  findBalanceDrift,
  signedAmount,
  validateMovement,
  type Movement,
} from "./movement.ts";

const mv = (m: Partial<Movement> & Pick<Movement, "type" | "amount">): Movement => ({
  account_id: null,
  card_id: null,
  ...m,
});

test("convención de signo (igual al trigger de Postgres)", () => {
  assert.deepEqual(balanceEffects(mv({ type: "expense", amount: 10, account_id: "a" })), [
    { target: "account", id: "a", delta: -10 },
  ]);
  assert.deepEqual(balanceEffects(mv({ type: "expense", amount: 10, card_id: "c" })), [
    { target: "card", id: "c", delta: 10 },
  ]);
  assert.deepEqual(balanceEffects(mv({ type: "income", amount: 10, account_id: "a" })), [
    { target: "account", id: "a", delta: 10 },
  ]);
  assert.deepEqual(
    balanceEffects(mv({ type: "card_payment", amount: 10, account_id: "a", card_id: "c" })),
    [
      { target: "account", id: "a", delta: -10 },
      { target: "card", id: "c", delta: -10 },
    ],
  );
});

test("un movimiento archivado no afecta saldos", () => {
  assert.deepEqual(
    balanceEffects(mv({ type: "income", amount: 10, account_id: "a", archived: true })),
    [],
  );
});

test("G1: los saldos se derivan de los movimientos", () => {
  const { accounts, cards } = deriveBalances([
    mv({ type: "income", amount: 1000, account_id: "a" }), // saldo inicial
    mv({ type: "expense", amount: 0.1, account_id: "a" }),
    mv({ type: "expense", amount: 0.2, account_id: "a" }),
    mv({ type: "expense", amount: 500, card_id: "c" }),
    mv({ type: "card_payment", amount: 600, account_id: "a", card_id: "c" }), // M4: supera la deuda
  ]);
  assert.equal(accounts.get("a"), 399.7);
  assert.equal(cards.get("c"), -100);
});

test("signedAmount: ingreso +, lo demás −", () => {
  assert.equal(signedAmount({ type: "income", amount: 5 }), 5);
  assert.equal(signedAmount({ type: "expense", amount: 5 }), -5);
  assert.equal(signedAmount({ type: "card_payment", amount: 5 }), -5);
});

const fails = (rule: string) => (e: unknown) => e instanceof DomainError && e.rule === rule;

test("G2: monto mayor que 0", () => {
  assert.throws(
    () => validateMovement({ type: "expense", amount: 0, category: "x", accountCurrency: "CRC" }),
    fails("G2"),
  );
});

test("M1: gasto e ingreso exigen categoría", () => {
  assert.throws(
    () => validateMovement({ type: "expense", amount: 1, category: " ", cardCurrency: "CRC" }),
    fails("M1"),
  );
  assert.equal(
    validateMovement({ type: "expense", amount: 1, category: "Comida", cardCurrency: "USD" }),
    "USD",
  );
});

test("M3/M5: un abono va de cuenta a tarjeta en la misma moneda", () => {
  assert.throws(
    () => validateMovement({ type: "card_payment", amount: 1, cardCurrency: "CRC" }),
    fails("M3"),
  );
  assert.throws(
    () =>
      validateMovement({
        type: "card_payment",
        amount: 1,
        accountCurrency: "CRC",
        cardCurrency: "USD",
      }),
    fails("M5"),
  );
  assert.equal(
    validateMovement({
      type: "card_payment",
      amount: 1,
      accountCurrency: "USD",
      cardCurrency: "USD",
    }),
    "USD",
  );
});

test("C1: el saldo inicial suma con signo a cuenta o tarjeta", () => {
  const { accounts, cards } = deriveBalances([
    mv({ type: "opening_balance", amount: -2_000, account_id: "a" }), // sobregiro inicial
    mv({ type: "income", amount: 5_000, account_id: "a" }),
    mv({ type: "opening_balance", amount: 150_000, card_id: "c" }), // deuda inicial
  ]);
  assert.equal(accounts.get("a"), 3_000);
  assert.equal(cards.get("c"), 150_000);
  assert.equal(signedAmount({ type: "opening_balance", amount: -2_000 }), -2_000);
});

test("C1: validación del saldo inicial", () => {
  assert.equal(
    validateMovement({ type: "opening_balance", amount: -10, accountCurrency: "USD" }),
    "USD",
  );
  assert.throws(
    () => validateMovement({ type: "opening_balance", amount: 0, accountCurrency: "CRC" }),
    fails("C1"),
  );
  assert.throws(
    () =>
      validateMovement({
        type: "opening_balance",
        amount: 10,
        accountCurrency: "CRC",
        cardCurrency: "CRC",
      }),
    fails("C1"),
  );
});

test("G1: findBalanceDrift reporta solo los saldos que no cuadran", () => {
  const movements = [
    mv({ type: "opening_balance", amount: 100, account_id: "a" }),
    mv({ type: "expense", amount: 30, card_id: "c" }),
  ];
  const drift = findBalanceDrift(
    [
      { target: "account", id: "a", stored: 100 },
      { target: "card", id: "c", stored: 45.5 },
      { target: "account", id: "vacía", stored: 0 },
    ],
    movements,
  );
  assert.deepEqual(drift, [
    { target: "card", id: "c", stored: 45.5, derived: 30, difference: 15.5 },
  ]);
});
