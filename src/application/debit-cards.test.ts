import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeStore } from "./fakes.test-helpers.ts";
import { saveDebitCard } from "./debit-cards.ts";
import { removeFromCatalog, setCatalogActive } from "./catalog.ts";
import { saveMovement } from "./movements.ts";
import { setExchangeRate } from "./exchange-rates.ts";

const base = { id: null, occurred_on: "2026-10-16", note: null, account_id: null, card_id: null };

test("C3: una tarjeta de débito por cuenta bancaria, no en efectivo", async () => {
  const s = fakeStore({ accounts: { bac: "CRC", caja: "CRC" }, accountTypes: { caja: "cash" } });
  const first = await saveDebitCard(s.deps, {
    id: null,
    fields: { account_id: "bac", name: " Débito BAC ", last_four: "1234" },
  });
  assert.ok(first.ok);
  assert.equal([...s.state.debitCardRows.values()][0].name, "Débito BAC");

  const second = await saveDebitCard(s.deps, {
    id: null,
    fields: { account_id: "bac", name: "Otra", last_four: null },
  });
  assert.equal(second.ok, false);

  const cash = await saveDebitCard(s.deps, {
    id: null,
    fields: { account_id: "caja", name: "X", last_four: null },
  });
  assert.equal(!cash.ok && cash.rule, "C3");
});

test("gasto con tarjeta de débito: sale de su cuenta; con historia se desactiva (G5)", async () => {
  const s = fakeStore({ accounts: { bac: "CRC", bn: "CRC" } });
  const card = await saveDebitCard(s.deps, {
    id: null,
    fields: { account_id: "bac", name: "Débito", last_four: "9876" },
  });
  assert.ok(card.ok);
  const cardId = card.value.id;

  const expense = { ...base, type: "expense" as const, amount: 4_500, category: "Comida" };
  const ok = await saveMovement(s.deps, { ...expense, account_id: "bac", debit_card_id: cardId });
  assert.ok(ok.ok);
  assert.equal([...s.state.movements.values()][0].debit_card_id, cardId);
  assert.equal(s.balanceOf("account", "bac"), -4_500);

  // C3: la tarjeta no es de la otra cuenta.
  const wrong = await saveMovement(s.deps, { ...expense, account_id: "bn", debit_card_id: cardId });
  assert.equal(!wrong.ok && wrong.rule, "C3");

  // G5: con gastos no se elimina; se desactiva y ya no se usa (G4).
  const del = await removeFromCatalog(s.deps.debitCards, "debitCard", cardId);
  assert.equal(!del.ok && del.rule, "G5");
  assert.ok((await setCatalogActive(s.deps.debitCards, "debitCard", cardId, false)).ok);
  const off = await saveMovement(s.deps, { ...expense, account_id: "bac", debit_card_id: cardId });
  assert.equal(!off.ok && off.rule, "G4");
});

test("M5: abono en dólares desde una cuenta en colones con el tipo de cambio", async () => {
  const s = fakeStore({ accounts: { bac: "CRC" }, cards: { visa: "CRC" } });
  const payment = { ...base, type: "card_payment" as const, amount: 20, category: null, account_id: "bac", card_id: "visa", currency: "USD" as const };

  const noRate = await saveMovement(s.deps, payment);
  assert.equal(!noRate.ok && noRate.rule, "M5");

  await setExchangeRate(s.deps, { rate_on: "2026-10-15", usd_crc: 505.5 });
  const r = await saveMovement(s.deps, payment);
  assert.ok(r.ok);
  const saved = [...s.state.movements.values()][0];
  assert.equal(saved.currency, "USD");
  assert.equal(saved.account_amount, 10_110);
  assert.equal(saved.exchange_rate, 505.5);
  assert.equal(s.balanceOf("account", "bac"), -10_110);
  assert.equal(s.balanceOf("card", "visa", "USD"), -20);

  // En la misma moneda, sin conversión.
  await saveMovement(s.deps, { ...payment, currency: null, amount: 1_000 });
  const plain = [...s.state.movements.values()][1];
  assert.equal(plain.currency, "CRC");
  assert.equal(plain.account_amount, null);
});
