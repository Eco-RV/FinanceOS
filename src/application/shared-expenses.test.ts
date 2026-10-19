import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeStore } from "./fakes.test-helpers.ts";
import { deleteMovement, saveMovement } from "./movements.ts";
import {
  createSharedExpense,
  deleteSharedExpense,
  markSharedPartPaid,
  recordSharedNotices,
  sendSharedNoticeEmail,
  shareExpense,
  undoSharedPartPaid,
  updateSharedExpense,
} from "./shared-expenses.ts";

const store = () =>
  fakeStore({
    accounts: { bac: "CRC", usd: "USD" },
    cards: { visa: "CRC" },
    members: { ana: "Ana", beto: "Beto" },
    cardCycles: { visa: { cutoff_day: 15, payment_due_day: 30 } },
  });

const dinner = {
  amount: 30_000,
  occurred_on: "2026-10-10",
  category: "Comida",
  note: null,
  account_id: null,
  card_id: "visa",
  currency: "CRC" as const,
};

test("X1/X3: registrar y compartir; con tarjeta la fecha límite es la del corte", async () => {
  const s = store();
  const r = await createSharedExpense(s.deps, {
    movement: dinner,
    description: "Cena",
    due_on: null,
    shares: [
      { member_id: "ana", amount: 10_000 },
      { member_id: "beto", amount: 10_000 },
    ],
  });
  assert.ok(r.ok);
  // X1: el gasto afecta la tarjeta por el total.
  assert.equal(s.balanceOf("card", "visa"), 30_000);
  const row = s.state.sharedRows.get(r.value.id)!;
  assert.equal(row.due_on, "2026-10-30");
  assert.equal(row.parts.length, 2);
});

test("X2: partes inválidas no dejan el gasto a medias", async () => {
  const s = store();
  const r = await createSharedExpense(s.deps, {
    movement: dinner,
    description: "Cena",
    due_on: null,
    shares: [{ member_id: "ana", amount: 40_000 }],
  });
  assert.equal(!r.ok && r.rule, "X2");
  assert.equal(s.state.movements.size, 0);
});

test("X3: desde una cuenta hace falta la fecha límite", async () => {
  const s = store();
  const base = { ...dinner, card_id: null, account_id: "bac", currency: null };
  const sinFecha = await createSharedExpense(s.deps, {
    movement: base,
    description: "Súper",
    due_on: null,
    shares: [{ member_id: "ana", amount: 5_000 }],
  });
  assert.equal(!sinFecha.ok && sinFecha.rule, "X3");
  assert.equal(s.state.movements.size, 0);

  const ok = await createSharedExpense(s.deps, {
    movement: base,
    description: "Súper",
    due_on: "2026-10-25",
    shares: [{ member_id: "ana", amount: 5_000 }],
  });
  assert.ok(ok.ok);
  assert.equal(s.state.sharedRows.get(ok.value.id)!.due_on, "2026-10-25");
});

test("X1: compartir un gasto existente una sola vez; no un ingreso", async () => {
  const s = store();
  const saved = await saveMovement(s.deps, { id: null, type: "expense", ...dinner });
  assert.ok(saved.ok);
  const first = await shareExpense(s.deps, {
    movement_id: saved.value.id,
    description: "",
    due_on: null,
    shares: [{ member_id: "ana", amount: 15_000 }],
  });
  assert.ok(first.ok);
  // Sin descripción, se usa una genérica.
  assert.equal(s.state.sharedRows.get(first.value.id)!.description, "Gasto compartido");
  const again = await shareExpense(s.deps, {
    movement_id: saved.value.id,
    description: "x",
    due_on: null,
    shares: [{ member_id: "ana", amount: 1 }],
  });
  assert.equal(!again.ok && again.rule, "X1");

  const income = await saveMovement(s.deps, {
    id: null,
    type: "income",
    amount: 100,
    occurred_on: "2026-10-10",
    category: "Otros",
    note: null,
    account_id: "bac",
    card_id: null,
  });
  assert.ok(income.ok);
  const bad = await shareExpense(s.deps, {
    movement_id: income.value.id,
    description: "x",
    due_on: null,
    shares: [{ member_id: "ana", amount: 1 }],
  });
  assert.equal(!bad.ok && bad.rule, "X1");
});

async function sharedDinner() {
  const s = store();
  const r = await createSharedExpense(s.deps, {
    movement: dinner,
    description: "Cena",
    due_on: null,
    shares: [
      { member_id: "ana", amount: 10_000 },
      { member_id: "beto", amount: 10_000 },
    ],
  });
  assert.ok(r.ok);
  return { s, id: r.value.id, movementId: r.value.movementId };
}

test("X4: pagar con ingreso suma a la cuenta; deshacer lo borra", async () => {
  const { s, id } = await sharedDinner();
  const paid = await markSharedPartPaid(s.deps, {
    id,
    member_id: "ana",
    paid_on: "2026-10-12",
    channel: "sinpe",
    note: null,
    income: { account_id: "bac", category: "Reembolso" },
  });
  assert.ok(paid.ok);
  assert.equal(s.balanceOf("account", "bac"), 10_000);
  const part = s.state.sharedRows.get(id)!.parts.find((p) => p.member_id === "ana")!;
  assert.equal(part.paid_on, "2026-10-12");
  assert.equal(part.income_transaction_id, paid.value.incomeId);

  // Una sola vez.
  const twice = await markSharedPartPaid(s.deps, {
    id,
    member_id: "ana",
    paid_on: "2026-10-13",
    channel: "efectivo",
    note: null,
    income: null,
  });
  assert.equal(!twice.ok && twice.rule, "X4");

  // X6: el ingreso del cobro no se edita ni se borra desde Ingresos.
  const del = await deleteMovement(s.deps, paid.value.incomeId!);
  assert.equal(!del.ok && del.rule, "X6");

  assert.ok((await undoSharedPartPaid(s.deps, { id, member_id: "ana" })).ok);
  assert.equal(s.balanceOf("account", "bac"), 0);
  assert.equal(s.state.sharedRows.get(id)!.parts[0].paid_on, null);
});

test("X4: sin ingreso es solo control; el ingreso exige la misma moneda (G3)", async () => {
  const { s, id } = await sharedDinner();
  const usd = await markSharedPartPaid(s.deps, {
    id,
    member_id: "beto",
    paid_on: "2026-10-12",
    channel: "transferencia",
    note: null,
    income: { account_id: "usd", category: "Reembolso" },
  });
  assert.equal(!usd.ok && usd.rule, "G3");
  const control = await markSharedPartPaid(s.deps, {
    id,
    member_id: "beto",
    paid_on: "2026-10-12",
    channel: "efectivo",
    note: "en la oficina",
    income: null,
  });
  assert.ok(control.ok);
  assert.equal(s.balanceOf("account", "bac"), 0);
});

test("X6: no se cambia la parte de quien pagó ni se deja de compartir con pagos", async () => {
  const { s, id, movementId } = await sharedDinner();
  await markSharedPartPaid(s.deps, {
    id,
    member_id: "ana",
    paid_on: "2026-10-12",
    channel: "sinpe",
    note: null,
    income: null,
  });
  const quitar = await updateSharedExpense(s.deps, {
    id,
    description: "Cena",
    due_on: null,
    shares: [{ member_id: "beto", amount: 10_000 }],
  });
  assert.equal(!quitar.ok && quitar.rule, "X6");
  const ajustar = await updateSharedExpense(s.deps, {
    id,
    description: "Cena del viernes",
    due_on: "2027-01-01",
    shares: [
      { member_id: "ana", amount: 10_000 },
      { member_id: "beto", amount: 12_000 },
    ],
  });
  assert.ok(ajustar.ok);
  const row = s.state.sharedRows.get(id)!;
  assert.equal(row.description, "Cena del viernes");
  // Con tarjeta, la fecha límite no se cambia a mano.
  assert.equal(row.due_on, "2026-10-30");

  const unshare = await deleteSharedExpense(s.deps, id);
  assert.equal(!unshare.ok && unshare.rule, "X6");

  // X6: el gasto compartido no cambia monto ni se elimina desde Gastos.
  const edit = await saveMovement(s.deps, { id: movementId, type: "expense", ...dinner, amount: 1 });
  assert.equal(!edit.ok && edit.rule, "X6");
  const noteOnly = await saveMovement(s.deps, { id: movementId, type: "expense", ...dinner, note: "con postre" });
  assert.ok(noteOnly.ok);
  const del = await deleteMovement(s.deps, movementId);
  assert.equal(!del.ok && del.rule, "X6");

  await undoSharedPartPaid(s.deps, { id, member_id: "ana" });
  assert.ok((await deleteSharedExpense(s.deps, id)).ok);
  // El movimiento queda.
  assert.ok(s.state.movements.has(movementId));
});

test("X5: avisos por WhatsApp (registro) y por correo", async () => {
  const { s, id } = await sharedDinner();
  const items = [{ shared_expense_id: id, member_id: "ana", quincenas: 1, channel: "whatsapp" as const }];
  assert.ok((await recordSharedNotices(s.deps.sharedExpenses, items)).ok);
  assert.equal(s.state.sharedNotices.length, 1);
  const mail = await sendSharedNoticeEmail(s.deps, {
    to: "ana@correo.cr",
    subject: "Cena",
    text: "Te toca ₡10 000",
    items: [{ ...items[0], channel: "email" }],
  });
  assert.ok(mail.ok);
  assert.equal(s.state.sentMail.length, 1);
  const noMail = await sendSharedNoticeEmail(s.deps, { to: null, subject: "", text: "", items });
  assert.equal(!noMail.ok && noMail.rule, "F8");
});
