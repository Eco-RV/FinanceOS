import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import { fromISODate } from "../shared/calendar.ts";
import {
  cardAvailability,
  cardStatementsByCurrency,
  rateBetween,
  validateExchangeRate,
} from "./multicurrency.ts";

const card = { cutoff_day: 15, payment_due_day: 5, currency: "CRC" as const };
const rate = { usd_crc: 500, rate_on: "2026-10-11" };

test("T1: un estado de cuenta por moneda y el estado más grave manda", () => {
  const m = cardStatementsByCurrency(
    card,
    [
      { type: "expense", amount: 10_000, occurred_on: "2026-09-01", currency: "CRC" },
      { type: "card_payment", amount: 10_000, occurred_on: "2026-09-20", currency: "CRC" },
      { type: "expense", amount: 40, occurred_on: "2026-09-02", currency: "USD" },
    ],
    fromISODate("2026-10-11"), // límite 2026-10-05 ya vencido
  );
  assert.deepEqual(m.currencies, ["CRC", "USD"]);
  assert.equal(m.byCurrency.CRC!.status, "al-dia");
  assert.equal(m.byCurrency.USD!.status, "atrasada");
  assert.equal(m.byCurrency.USD!.dueAmount, 40);
  assert.equal(m.status, "atrasada");
});

test("T1: sin movimientos en USD solo aparece la moneda del límite", () => {
  const m = cardStatementsByCurrency(card, [], fromISODate("2026-10-11"));
  assert.deepEqual(m.currencies, ["CRC"]);
  assert.equal(m.status, "sin-movimientos");
});

test("T2: disponible en colones convierte el saldo en dólares", () => {
  assert.deepEqual(
    cardAvailability({
      creditLimit: 1_000_000,
      limitCurrency: "CRC",
      balances: { CRC: 200_000, USD: 100 },
      rate,
    }),
    { used: 250_000, available: 750_000, missingRate: false },
  );
});

test("T2: sin tipo de cambio no se puede calcular si hay saldo en otra moneda", () => {
  const r = cardAvailability({
    creditLimit: 1_000_000,
    limitCurrency: "CRC",
    balances: { CRC: 200_000, USD: 100 },
    rate: null,
  });
  assert.equal(r.missingRate, true);
  assert.equal(r.available, null);
  // Solo colones: no hace falta tipo de cambio.
  assert.equal(
    cardAvailability({ creditLimit: 500, limitCurrency: "CRC", balances: { CRC: 100 }, rate: null })
      .available,
    400,
  );
});

test("rateBetween y validación del tipo de cambio", () => {
  assert.equal(rateBetween("USD", "CRC", rate), 500);
  assert.equal(rateBetween("CRC", "USD", rate), 1 / 500);
  assert.equal(rateBetween("CRC", "CRC", null), 1);
  assert.throws(() => validateExchangeRate(0), DomainError);
});
