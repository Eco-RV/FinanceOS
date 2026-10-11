import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import {
  balanceEffects,
  deriveBalances,
  findBalanceDrift,
  normalizeSinpePhone,
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
  const C = "CRC" as const;
  assert.deepEqual(balanceEffects(mv({ type: "expense", amount: 10, account_id: "a" })), [
    { target: "account", id: "a", delta: -10, currency: C },
  ]);
  assert.deepEqual(balanceEffects(mv({ type: "expense", amount: 10, card_id: "c" })), [
    { target: "card", id: "c", delta: 10, currency: C },
  ]);
  assert.deepEqual(balanceEffects(mv({ type: "income", amount: 10, account_id: "a" })), [
    { target: "account", id: "a", delta: 10, currency: C },
  ]);
  assert.deepEqual(
    balanceEffects(mv({ type: "card_payment", amount: 10, account_id: "a", card_id: "c" })),
    [
      { target: "account", id: "a", delta: -10, currency: C },
      { target: "card", id: "c", delta: -10, currency: C },
    ],
  );
});

test("T1: una tarjeta lleva un saldo por moneda", () => {
  const movements = [
    mv({ type: "expense", amount: 50_000, card_id: "c", currency: "CRC" }),
    mv({ type: "expense", amount: 120, card_id: "c", currency: "USD" }),
    mv({ type: "card_payment", amount: 20, account_id: "usd", card_id: "c", currency: "USD" }),
  ];
  assert.deepEqual(deriveBalances(movements).cards.get("c"), { CRC: 50_000, USD: 100 });
  assert.deepEqual(
    findBalanceDrift(
      [
        { target: "card", id: "c", currency: "CRC", stored: 50_000 },
        { target: "card", id: "c", currency: "USD", stored: 90 },
      ],
      movements,
    ).map((d) => [d.currency, d.difference]),
    [["USD", -10]],
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
  assert.deepEqual(cards.get("c"), { CRC: -100 });
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

test("M3/M5: un abono va de cuenta a tarjeta, en la moneda de la cuenta", () => {
  assert.throws(
    () => validateMovement({ type: "card_payment", amount: 1, cardCurrency: "CRC" }),
    fails("M3"),
  );
  // T1/M5: la tarjeta acepta ambas monedas; el abono va al saldo de la moneda de la cuenta.
  assert.equal(
    validateMovement({
      type: "card_payment",
      amount: 1,
      accountCurrency: "CRC",
      cardCurrency: "USD",
    }),
    "CRC",
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
  assert.deepEqual(cards.get("c"), { CRC: 150_000 });
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

test("M2: una transferencia baja el origen, sube el destino y no es gasto", () => {
  const { accounts } = deriveBalances([
    mv({ type: "opening_balance", amount: 100_000, account_id: "bac" }),
    mv({ type: "transfer", amount: 40_000, account_id: "bac", to_account_id: "bn" }),
  ]);
  assert.equal(accounts.get("bac"), 60_000);
  assert.equal(accounts.get("bn"), 40_000);
});

test("M2: validación de transferencias", () => {
  const ok = { type: "transfer" as const, amount: 1, accountId: "a", toAccountId: "b" };
  assert.equal(validateMovement({ ...ok, accountCurrency: "USD", toAccountCurrency: "USD" }), "USD");
  assert.throws(
    () => validateMovement({ ...ok, accountCurrency: "CRC", toAccountCurrency: "USD" }),
    fails("M2"),
  );
  assert.throws(
    () => validateMovement({ ...ok, toAccountId: "a", accountCurrency: "CRC", toAccountCurrency: "CRC" }),
    fails("M2"),
  );
  assert.throws(() => validateMovement({ ...ok, accountCurrency: "CRC" }), fails("M2"));
});

test("S1: un SINPE es un gasto desde cuenta, con categoría y teléfono válido", () => {
  const sinpe = { type: "expense" as const, amount: 5_000, category: "Comida", channel: "sinpe" as const };
  assert.equal(validateMovement({ ...sinpe, accountCurrency: "CRC", counterpartyPhone: "8888-1234" }), "CRC");
  assert.throws(() => validateMovement({ ...sinpe, cardCurrency: "CRC" }), fails("S1"));
  assert.throws(
    () => validateMovement({ ...sinpe, accountCurrency: "CRC", counterpartyPhone: "123" }),
    fails("S1"),
  );
  assert.throws(() => validateMovement({ ...sinpe, category: "", accountCurrency: "CRC" }), fails("M1"));
});

test("S1: normalizeSinpePhone", () => {
  assert.equal(normalizeSinpePhone("+506 8888-1234"), "88881234");
  assert.equal(normalizeSinpePhone("50601234"), "50601234");
  assert.equal(normalizeSinpePhone("  "), null);
  assert.equal(normalizeSinpePhone(null), null);
  assert.throws(() => normalizeSinpePhone("8888"), fails("S1"));
});

test("T1: un cargo de tarjeta puede ser en otra moneda que la del límite", () => {
  const charge = { type: "expense" as const, amount: 30, category: "Viaje", cardCurrency: "CRC" as const };
  assert.equal(validateMovement(charge), "CRC");
  assert.equal(validateMovement({ ...charge, currency: "USD" }), "USD");
  // En una cuenta manda la moneda de la cuenta.
  assert.equal(
    validateMovement({ ...charge, cardCurrency: null, accountCurrency: "CRC", currency: "USD" }),
    "CRC",
  );
});
