import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeStore } from "./fakes.test-helpers.ts";
import { deleteMovement, saveMovement } from "./movements.ts";
import { createFinancing, deleteFinancing } from "./financings.ts";
import { approvePending, rejectPending } from "./pending.ts";
import { saveAccount, saveCard } from "./products.ts";
import { checkBalances, recomputeBalances } from "./balances.ts";
import { setExchangeRate } from "./exchange-rates.ts";

const base = {
  id: null,
  occurred_on: "2026-10-11",
  note: null,
  account_id: null,
  card_id: null,
};

test("saveMovement: un gasto copia la moneda del origen y ajusta el saldo", async () => {
  const s = fakeStore({ cards: { visa: "USD" } });
  const r = await saveMovement(s.deps, {
    ...base,
    type: "expense",
    amount: 25,
    category: "Comida",
    card_id: "visa",
  });
  assert.deepEqual(r, { ok: true, value: { affectedCardIds: ["visa"], id: "mv-1" } });
  assert.equal([...s.state.movements.values()][0].currency, "USD");
  assert.equal(s.balanceOf("card", "visa"), 25);
});

test("T1/M5: un abono en dólares baja el saldo en dólares de una tarjeta en colones", async () => {
  const s = fakeStore({ accounts: { usd: "USD" }, cards: { visa: "CRC" } });
  await saveMovement(s.deps, {
    ...base,
    type: "expense",
    amount: 80,
    category: "Viaje",
    card_id: "visa",
    currency: "USD",
  });
  const r = await saveMovement(s.deps, {
    ...base,
    type: "card_payment",
    amount: 30,
    category: null,
    account_id: "usd",
    card_id: "visa",
  });
  assert.ok(r.ok);
  assert.equal(s.balanceOf("card", "visa", "USD"), 50);
  assert.equal(s.balanceOf("card", "visa", "CRC"), 0);
  assert.equal(s.balanceOf("account", "usd"), -30);
});

test("saveMovement: un origen inexistente se rechaza", async () => {
  const s = fakeStore();
  const r = await saveMovement(s.deps, {
    ...base,
    type: "expense",
    amount: 10,
    category: "Comida",
    account_id: "nope",
  });
  assert.equal(r.ok, false);
});

test("saveMovement: editar informa la tarjeta anterior y la nueva", async () => {
  const s = fakeStore({ cards: { a: "CRC", b: "CRC" } });
  await saveMovement(s.deps, { ...base, type: "expense", amount: 5, category: "x", card_id: "a" });
  const r = await saveMovement(s.deps, {
    ...base,
    id: "mv-1",
    type: "expense",
    amount: 5,
    category: "x",
    card_id: "b",
  });
  assert.deepEqual(r.ok && r.value.affectedCardIds.sort(), ["a", "b"]);
  assert.equal(s.balanceOf("card", "a"), 0);
  assert.equal(s.balanceOf("card", "b"), 5);
});

test("deleteMovement revierte el saldo", async () => {
  const s = fakeStore({ accounts: { bac: "CRC" } });
  await saveMovement(s.deps, { ...base, type: "income", amount: 100, category: "Salario", account_id: "bac" });
  assert.equal(s.balanceOf("account", "bac"), 100);
  await deleteMovement(s.deps, "mv-1");
  assert.equal(s.balanceOf("account", "bac"), 0);
});

test("createFinancing valida en el dominio y devuelve el plan de cuotas", async () => {
  const s = fakeStore({ cards: { visa: "CRC" } });
  const input = {
    card_id: "visa",
    description: "TV",
    category: "Hogar",
    total_amount: 300_000,
    months: 3,
    first_charge_on: "2026-10-31",
  };
  const r = await createFinancing(s.deps, input);
  assert.ok(r.ok);
  assert.deepEqual(
    r.value.installments.map((c) => c.occurred_on),
    ["2026-10-31", "2026-11-30", "2026-12-31"],
  );

  const bad = await createFinancing(s.deps, { ...input, months: 1 });
  assert.equal(!bad.ok && bad.rule, "F1");
  assert.equal(s.state.financings.size, 1);

  // F4: el 15 de nov ya ocurrió la cuota 1 (31 oct) y la 2 (30 nov) no.
  const del = await deleteFinancing(s.deps, r.value.id, new Date(2026, 10, 15));
  assert.deepEqual(del, { ok: true, value: { cardId: "visa", outcome: "cancelled" } });
  assert.equal(s.state.movements.size, 1);
  assert.equal(s.balanceOf("card", "visa"), 100_000);
  assert.equal(s.state.cancelled.get(r.value.id), "2026-11-15");
});

test("F4: si ninguna cuota ocurrió, eliminar borra el plan completo", async () => {
  const s = fakeStore({ cards: { visa: "CRC" } });
  const r = await createFinancing(s.deps, {
    card_id: "visa",
    description: "Cel",
    category: null,
    total_amount: 1000,
    months: 2,
    first_charge_on: "2026-12-01",
  });
  assert.ok(r.ok);
  const del = await deleteFinancing(s.deps, r.value.id, new Date(2026, 10, 15));
  assert.ok(del.ok && del.value.outcome === "deleted");
  assert.equal(s.state.movements.size, 0);
  assert.equal(s.state.financings.size, 0);
});

const purchase = {
  id: "p1",
  merchant: "WALMART GUADALUPE WCN0",
  amount: 12_500,
  currency: "CRC",
  occurred_on: "2026-10-10",
};

test("approvePending crea el gasto y aprende la categoría del comercio", async () => {
  const s = fakeStore({ cards: { visa: "CRC" }, pending: [purchase] });
  const r = await approvePending(s.deps, { id: "p1", card_id: "visa", category: "Súper" });
  assert.ok(r.ok);
  assert.equal(s.balanceOf("card", "visa"), 12_500);
  assert.equal(s.state.pending.get("p1")!.status, "approved");
  assert.equal(s.state.rules.get("walmart guadalupe"), "Súper");

  const again = await approvePending(s.deps, { id: "p1", card_id: "visa", category: "Súper" });
  assert.equal(again.ok, false);
  assert.equal(s.state.movements.size, 1);
});

test("T1/I5: un pendiente en colones se aprueba en una tarjeta con límite en dólares", async () => {
  const s = fakeStore({ cards: { amex: "USD" }, pending: [purchase] });
  const r = await approvePending(s.deps, { id: "p1", card_id: "amex", category: "Súper" });
  assert.ok(r.ok);
  assert.equal(s.balanceOf("card", "amex", "CRC"), 12_500);
});

test("rejectPending descarta sin crear movimientos", async () => {
  const s = fakeStore({ pending: [purchase] });
  await rejectPending(s.deps, "p1");
  assert.equal(s.state.pending.get("p1")!.status, "rejected");
  assert.equal(s.state.movements.size, 0);
});

const accountFields = { name: "BAC", type: "checking", institution: null, currency: "CRC" as const };

test("C1: crear una cuenta con saldo inicial crea el movimiento", async () => {
  const s = fakeStore();
  const r = await saveAccount(s.deps, {
    id: null,
    fields: accountFields,
    opening: { amount: 250_000, occurred_on: "2026-10-01" },
  });
  assert.ok(r.ok);
  const id = r.value.id;
  assert.equal(s.balanceOf("account", id), 250_000);
  const opening = await s.deps.movements.openingOf("account", id, "CRC");
  assert.deepEqual(opening && [opening.amount, opening.occurred_on], [250_000, "2026-10-01"]);

  // Editar cambia el mismo movimiento (no crea otro).
  await saveAccount(s.deps, {
    id,
    fields: accountFields,
    opening: { amount: -5_000, occurred_on: "2026-09-30" },
  });
  assert.equal(s.state.movements.size, 1);
  assert.equal(s.balanceOf("account", id), -5_000);

  // En 0 se elimina.
  await saveAccount(s.deps, { id, fields: accountFields, opening: { amount: 0, occurred_on: "2026-09-30" } });
  assert.equal(s.state.movements.size, 0);
});

test("saveCard: el saldo inicial de una tarjeta es deuda", async () => {
  const s = fakeStore();
  const r = await saveCard(s.deps, {
    id: null,
    fields: {
      name: "Visa",
      institution: null,
      last_four: "1234",
      credit_limit: 1_000_000,
      cutoff_day: 15,
      payment_due_day: 5,
      currency: "USD",
    },
    openings: [
      { currency: "USD", amount: 300, occurred_on: "2026-09-01" },
      { currency: "CRC", amount: 50_000, occurred_on: "2026-09-01" },
    ],
  });
  assert.ok(r.ok);
  assert.equal(s.balanceOf("card", r.value.id, "USD"), 300);
  assert.equal(s.balanceOf("card", r.value.id, "CRC"), 50_000);
  assert.equal(s.state.movements.size, 2);
});

test("T2: setExchangeRate guarda el tipo de cambio y rechaza valores inválidos", async () => {
  const s = fakeStore();
  assert.ok((await setExchangeRate(s.deps, { usd_crc: 505.25, rate_on: "2026-10-11" })).ok);
  const bad = await setExchangeRate(s.deps, { usd_crc: 0, rate_on: "2026-10-12" });
  assert.equal(!bad.ok && bad.rule, "T2");
  assert.deepEqual(await s.deps.exchangeRates.latest(), { usd_crc: 505.25, rate_on: "2026-10-11" });
});

test("G1: checkBalances detecta y recomputeBalances corrige el saldo guardado", async () => {
  const s = fakeStore({ accounts: { bac: "CRC" } });
  await saveMovement(s.deps, { ...base, type: "income", amount: 100, category: "x", account_id: "bac" });
  s.state.stored.set("bac", 90);

  const before = await checkBalances(s.deps);
  assert.ok(before.ok);
  assert.deepEqual(before.value.drift.map((d) => [d.id, d.difference]), [["bac", -10]]);

  const fixed = await recomputeBalances(s.deps);
  assert.deepEqual(fixed, { ok: true, value: { changed: 1 } });
  const after = await checkBalances(s.deps);
  assert.ok(after.ok && after.value.drift.length === 0);
});

test("transferencia: mueve plata entre cuentas propias sin ser gasto", async () => {
  const s = fakeStore({ accounts: { bac: "CRC", bn: "CRC", usd: "USD" } });
  const r = await saveMovement(s.deps, {
    ...base,
    type: "transfer",
    amount: 50_000,
    category: null,
    account_id: "bac",
    to_account_id: "bn",
  });
  assert.ok(r.ok);
  assert.equal(s.balanceOf("account", "bac"), -50_000);
  assert.equal(s.balanceOf("account", "bn"), 50_000);

  const crossCurrency = await saveMovement(s.deps, {
    ...base,
    type: "transfer",
    amount: 10,
    category: null,
    account_id: "bac",
    to_account_id: "usd",
  });
  assert.equal(!crossCurrency.ok && crossCurrency.rule, "M2");
});

test("SINPE: gasto desde cuenta con destinatario y teléfono normalizado", async () => {
  const s = fakeStore({ accounts: { bac: "CRC" } });
  const r = await saveMovement(s.deps, {
    ...base,
    type: "expense",
    amount: 7_500,
    category: "Comida",
    account_id: "bac",
    channel: "sinpe",
    counterparty_name: "  Doña Ana ",
    counterparty_phone: "8888-1234",
  });
  assert.ok(r.ok);
  const saved = [...s.state.movements.values()][0];
  assert.equal(saved.counterparty_name, "Doña Ana");
  assert.equal(saved.counterparty_phone, "88881234");
  assert.equal(s.balanceOf("account", "bac"), -7_500);
});
