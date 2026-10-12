import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeStore } from "./fakes.test-helpers.ts";
import { removeFromCatalog, saveBank, saveCategory, seedCategories, setCatalogActive } from "./catalog.ts";
import { saveMovement } from "./movements.ts";
import { approvePending } from "./pending.ts";
import { saveAccount, saveCard } from "./products.ts";
import { createFinancing } from "./financings.ts";

const expense = {
  id: null,
  type: "expense" as const,
  amount: 1_000,
  occurred_on: "2026-10-11",
  category: "Comida",
  note: null,
  account_id: "bcr",
  card_id: null,
};

const cardFields = {
  name: "Visa",
  institution: null,
  last_four: null,
  credit_limit: 1_000_000,
  cutoff_day: 15,
  payment_due_day: 1,
  currency: "CRC" as const,
};

const bank = { name: "BAC", sender_emails: ["avisos@bac.cr"], parser_key: "bac", enabled: true };

test("G5: una cuenta solo con su saldo inicial se puede eliminar", async () => {
  const s = fakeStore();
  const r = await saveAccount(s.deps, {
    id: null,
    fields: { name: "Por error", type: "checking", institution: null, currency: "CRC" },
    opening: { amount: 5_000, occurred_on: "2026-10-01" },
  });
  assert.ok(r.ok);
  const removed = await removeFromCatalog(s.deps.accounts, "account", r.value.id);
  assert.deepEqual(removed, { ok: true, value: undefined });
  assert.equal(s.state.accountRows.has(r.value.id), false);
});

test("G5: una cuenta con movimientos no se elimina; se desactiva y se reactiva", async () => {
  const s = fakeStore({ accounts: { bcr: "CRC" } });
  assert.ok((await saveMovement(s.deps, expense)).ok);

  const removed = await removeFromCatalog(s.deps.accounts, "account", "bcr");
  assert.equal(removed.ok, false);
  assert.equal(!removed.ok && removed.rule, "G5");
  assert.equal(s.state.accountRows.has("bcr"), true);

  assert.ok((await setCatalogActive(s.deps.accounts, "account", "bcr", false)).ok);
  assert.equal(s.state.accountRows.get("bcr")!.archived, true);
  // La historia y el saldo se conservan.
  assert.equal(s.state.movements.size, 1);
  assert.equal(s.balanceOf("account", "bcr"), -1_000);

  assert.ok((await setCatalogActive(s.deps.accounts, "account", "bcr", true)).ok);
  assert.equal(s.state.accountRows.get("bcr")!.archived, false);
});

test("G5: una transferencia recibida también es historia de la cuenta destino", async () => {
  const s = fakeStore({ accounts: { bcr: "CRC", ahorro: "CRC" } });
  await saveMovement(s.deps, {
    ...expense,
    type: "transfer",
    category: null,
    to_account_id: "ahorro",
  });
  const r = await removeFromCatalog(s.deps.accounts, "account", "ahorro");
  assert.equal(!r.ok && r.rule, "G5");
});

test("G4: no se registra ni se edita sobre una cuenta desactivada", async () => {
  const s = fakeStore({ accounts: { bcr: "CRC" } });
  await setCatalogActive(s.deps.accounts, "account", "bcr", false);

  const mv = await saveMovement(s.deps, expense);
  assert.equal(mv.ok, false);
  assert.equal(s.state.movements.size, 0);

  const edit = await saveAccount(s.deps, {
    id: "bcr",
    fields: { name: "BCR", type: "checking", institution: null, currency: "CRC" },
    opening: { amount: 0, occurred_on: "2026-10-01" },
  });
  assert.equal(!edit.ok && edit.rule, "G4");
});

test("G5: un financiamiento es historia de la tarjeta", async () => {
  const s = fakeStore({ cards: { visa: "CRC" } });
  const f = await createFinancing(s.deps, {
    card_id: "visa",
    description: "TV",
    category: "Hogar",
    total_amount: 300_000,
    months: 3,
    first_charge_on: "2026-10-05",
  });
  assert.ok(f.ok);
  const r = await removeFromCatalog(s.deps.cards, "card", "visa");
  assert.equal(!r.ok && r.rule, "G5");
  assert.match(!r.ok ? r.message : "", /desactívala en vez de eliminarla/);
});

test("G4: una tarjeta no se asocia a un banco desactivado, pero conserva el que ya tenía", async () => {
  const s = fakeStore({
    banks: { bac: { ...bank, archived: false }, bn: { ...bank, name: "BN", archived: true } },
  });
  const created = await saveCard(s.deps, { id: null, fields: { ...cardFields, bank_id: "bn" }, openings: [] });
  assert.equal(!created.ok && created.rule, "G4");
  assert.equal(s.state.cardRows.size, 0);

  const ok = await saveCard(s.deps, { id: null, fields: { ...cardFields, bank_id: "bac" }, openings: [] });
  assert.ok(ok.ok);
  await setCatalogActive(s.deps.banks, "bank", "bac", false);
  const kept = await saveCard(s.deps, {
    id: ok.value.id,
    fields: { ...cardFields, name: "Visa Oro", bank_id: "bac" },
    openings: [],
  });
  assert.ok(kept.ok);
});

test("G4: no se usa una categoría desactivada; al editar se puede conservar", async () => {
  const s = fakeStore({
    accounts: { bcr: "CRC" },
    categories: { c1: { kind: "expense", name: "Comida", archived: false } },
  });
  const first = await saveMovement(s.deps, expense);
  assert.ok(first.ok);
  const [movementId] = [...s.state.movements.keys()];

  await setCatalogActive(s.deps.categories, "category", "c1", false);

  const fresh = await saveMovement(s.deps, { ...expense, category: "comida" });
  assert.equal(!fresh.ok && fresh.rule, "G4");

  const edit = await saveMovement(s.deps, { ...expense, id: movementId, amount: 2_000 });
  assert.ok(edit.ok);
  assert.equal(s.balanceOf("account", "bcr"), -2_000);

  // Un ingreso con el mismo nombre no choca: otro tipo de categoría.
  const income = await saveMovement(s.deps, { ...expense, type: "income" });
  assert.ok(income.ok);
});

test("G4: un pendiente no se aprueba con una categoría desactivada", async () => {
  const s = fakeStore({
    cards: { visa: "CRC" },
    categories: { c1: { kind: "expense", name: "Súper", archived: true } },
    pending: [{ id: "p1", merchant: "WALMART", amount: 100, currency: "CRC", occurred_on: "2026-10-10" }],
  });
  const r = await approvePending(s.deps, { id: "p1", card_id: "visa", category: "Súper" });
  assert.equal(!r.ok && r.rule, "G4");
  assert.equal(s.state.movements.size, 0);
});

test("G5: una categoría sin movimientos se elimina; con movimientos, no", async () => {
  const s = fakeStore({
    accounts: { bcr: "CRC" },
    categories: {
      c1: { kind: "expense", name: "Comida", archived: false },
      c2: { kind: "expense", name: "Ropa", archived: false },
    },
  });
  await saveMovement(s.deps, expense);
  const used = await removeFromCatalog(s.deps.categories, "category", "c1");
  assert.equal(!used.ok && used.rule, "G5");
  assert.ok((await removeFromCatalog(s.deps.categories, "category", "c2")).ok);
  assert.equal(s.state.categoryRows.has("c2"), false);
});

test("saveCategory: no renombra una desactivada y rechaza duplicados", async () => {
  const s = fakeStore({
    categories: {
      c1: { kind: "expense", name: "Comida", archived: false },
      c2: { kind: "expense", name: "Viejo", archived: true },
    },
  });
  const archived = await saveCategory(s.deps.categories, { id: "c2", fields: { kind: "expense", name: "Nuevo" } });
  assert.equal(!archived.ok && archived.rule, "G4");
  const dup = await saveCategory(s.deps.categories, { id: null, fields: { kind: "expense", name: "comida" } });
  assert.deepEqual(dup, { ok: false, message: "Ya existe esa categoría", rule: undefined });
});

test("seedCategories no revive las desactivadas ni duplica", async () => {
  const s = fakeStore({
    categories: { c1: { kind: "expense", name: "Comida", archived: true } },
  });
  const r = await seedCategories(s.deps.categories, "expense", ["Comida", "Transporte"]);
  assert.deepEqual(r, { ok: true, value: { added: 1 } });
  assert.deepEqual(
    [...s.state.categoryRows.values()].map((c) => [c.name, c.archived]),
    [["Comida", true], ["Transporte", false]],
  );
});

test("G5: un banco con avisos importados no se elimina; uno nuevo sí", async () => {
  const s = fakeStore({
    banks: { bac: { ...bank, archived: false } },
    pending: [
      { id: "p1", merchant: "X", amount: 1, currency: "CRC", occurred_on: "2026-10-10", bank_id: "bac" },
    ],
  });
  const r = await removeFromCatalog(s.deps.banks, "bank", "bac");
  assert.match(!r.ok ? r.message : "", /El banco "BAC" tiene avisos importados: desactívalo/);

  const created = await saveBank(s.deps.banks, { id: null, fields: { ...bank, name: "BN" } });
  assert.ok(created.ok);
  assert.ok((await removeFromCatalog(s.deps.banks, "bank", created.value.id)).ok);
});

test("removeFromCatalog: algo que no existe da un mensaje claro", async () => {
  const s = fakeStore();
  assert.deepEqual(await removeFromCatalog(s.deps.cards, "card", "nada"), {
    ok: false,
    message: "Tarjeta no encontrada",
    rule: undefined,
  });
});
