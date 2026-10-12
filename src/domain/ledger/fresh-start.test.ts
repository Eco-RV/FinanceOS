import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import { isFreshStartConfirmed, planFreshStart, type FreshStartProduct } from "./fresh-start.ts";

const products: FreshStartProduct[] = [
  { kind: "account", id: "bcr", name: "BCR", currencies: ["CRC"] },
  { kind: "card", id: "visa", name: "Visa", currencies: ["CRC", "USD"] },
];

const openings = [
  { kind: "account" as const, id: "bcr", currency: "CRC" as const, amount: 300_000 },
  { kind: "card" as const, id: "visa", currency: "CRC" as const, amount: 120_000 },
  { kind: "card" as const, id: "visa", currency: "USD" as const, amount: 0 },
];

function message(fn: () => unknown): string {
  try {
    fn();
    return "";
  } catch (e) {
    assert.ok(e instanceof DomainError);
    assert.equal(e.rule, "M8");
    return e.message;
  }
}

test("M8: la confirmación escrita es obligatoria", () => {
  assert.equal(isFreshStartConfirmed(" arrancar "), true);
  assert.equal(isFreshStartConfirmed("si"), false);
  assert.match(message(() => planFreshStart({ confirmation: "", products, openings })), /Escribí ARRANCAR/);
});

test("M8: devuelve solo los saldos distintos de 0", () => {
  const plan = planFreshStart({ confirmation: "ARRANCAR", products, openings });
  assert.deepEqual(plan.map((o) => [o.id, o.currency, o.amount]), [
    ["bcr", "CRC", 300_000],
    ["visa", "CRC", 120_000],
  ]);
});

test("M8: exige un saldo por cuenta y por moneda de cada tarjeta", () => {
  assert.match(
    message(() => planFreshStart({ confirmation: "ARRANCAR", products, openings: openings.slice(0, 2) })),
    /Falta el saldo inicial de "Visa" en USD/,
  );
  assert.match(
    message(() => planFreshStart({ confirmation: "ARRANCAR", products, openings: openings.slice(1) })),
    /Falta el saldo inicial de "BCR"$/,
  );
});

test("M8: rechaza saldos de algo que no está activo o inválidos", () => {
  const extra = [...openings, { kind: "account" as const, id: "vieja", currency: "CRC" as const, amount: 5 }];
  assert.match(message(() => planFreshStart({ confirmation: "ARRANCAR", products, openings: extra })), /no está activa/);
  const nan = [{ ...openings[0], amount: Number.NaN }, ...openings.slice(1)];
  assert.match(message(() => planFreshStart({ confirmation: "ARRANCAR", products, openings: nan })), /inválido/);
});

test("M8: sin cuentas ni tarjetas, el arranque solo archiva", () => {
  assert.deepEqual(planFreshStart({ confirmation: "ARRANCAR", products: [], openings: [] }), []);
});
