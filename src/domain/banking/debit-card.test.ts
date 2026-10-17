import assert from "node:assert/strict";
import { test } from "node:test";
import { assertDebitCardUsable, debitCardLabel, validateDebitCard } from "./debit-card.ts";

test("C3: tarjeta de débito de una cuenta bancaria", () => {
  validateDebitCard({ name: "Débito BCR", last_four: "1234" }, "checking");
  validateDebitCard({ name: "Ahorro", last_four: null }, "savings");
  assert.throws(() => validateDebitCard({ name: "Caja", last_four: null }, "cash"), /cuenta bancaria/);
  assert.throws(() => validateDebitCard({ name: " ", last_four: null }, "checking"), /nombre/);
  assert.throws(() => validateDebitCard({ name: "X", last_four: "12a4" }, "checking"), /4 números/);
});

test("G4/C3: la tarjeta existe, está activa y es de la cuenta", () => {
  const card = { account_id: "a1", name: "Débito", archived: false };
  assertDebitCardUsable(card, "a1");
  assert.throws(() => assertDebitCardUsable(null, "a1"), /no encontrada/);
  assert.throws(() => assertDebitCardUsable({ ...card, archived: true }, "a1"), /desactivada/);
  assert.throws(() => assertDebitCardUsable(card, "a2"), /no es de esa cuenta/);
});

test("etiqueta con los últimos 4 dígitos", () => {
  assert.equal(debitCardLabel({ name: "Débito", last_four: "1234" }), "Débito ••1234");
  assert.equal(debitCardLabel({ name: "Débito", last_four: null }), "Débito");
});
