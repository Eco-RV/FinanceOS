import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeStore } from "./fakes.test-helpers.ts";
import { createFinancing, updateFinancing } from "./financings.ts";
import {
  recordNotices,
  recordReimbursement,
  saveMember,
  sendNoticeEmail,
  setFinancingShares,
  undoReimbursement,
} from "./members.ts";
import { removeFromCatalog, setCatalogActive } from "./catalog.ts";

async function setup() {
  const s = fakeStore({ cards: { visa: "CRC" }, members: { mama: "Mamá", hermano: "Hermano" } });
  const r = await createFinancing(s.deps, {
    card_id: "visa",
    description: "Refri",
    category: "Hogar",
    total_amount: 600_000,
    annual_rate: 24,
    months: 12,
    first_charge_on: "2026-11-05",
  });
  assert.ok(r.ok);
  return { s, id: r.value.id };
}

test("F5: con tasa guarda cada cuota completa con su interés; el saldo suma el plan entero", async () => {
  const { s } = await setup();
  const rows = [...s.state.movements.values()];
  assert.equal(rows.length, 12);
  assert.equal(rows[0].amount, 56_735.76);
  assert.equal(rows[0].interest_amount, 12_000);
  assert.ok(Math.abs(s.balanceOf("card", "visa") - 680_829.1) < 0.05);
});

test("F9: editar cambia descripción y categoría del plan y de sus cuotas", async () => {
  const { s, id } = await setup();
  const r = await updateFinancing(s.deps, { id, description: "Refrigeradora", category: "Casa" });
  assert.deepEqual(r, { ok: true, value: { cardId: "visa" } });
  const first = [...s.state.movements.values()][0];
  assert.equal(first.note, "Refrigeradora (cuota 1/12)");
  assert.equal(first.category, "Casa");
  assert.equal((await updateFinancing(s.deps, { id: "nada", description: "x", category: null })).ok, false);
});

test("F6: reparto por cuota — no pasa la cuota más baja ni usa miembros desactivados", async () => {
  const { s, id } = await setup();
  const ok = await setFinancingShares(s.deps, {
    financing_id: id,
    shares: [{ member_id: "mama", amount: 30_000 }, { member_id: "hermano", amount: 20_000 }],
  });
  assert.ok(ok.ok);
  const tooMuch = await setFinancingShares(s.deps, {
    financing_id: id,
    shares: [{ member_id: "mama", amount: 56_735.76 }],
  });
  assert.equal(!tooMuch.ok && tooMuch.rule, "F6");

  s.state.memberRows.set("tia", { name: "Tía", email: null, phone: "50688887777", archived: true });
  const inactive = await setFinancingShares(s.deps, {
    financing_id: id,
    shares: [{ member_id: "tia", amount: 1_000 }],
  });
  assert.equal(!inactive.ok && inactive.rule, "G4");
});

test("F7: reembolso por el monto de la parte, una sola vez; no se quita a quien ya pagó", async () => {
  const { s, id } = await setup();
  await setFinancingShares(s.deps, { financing_id: id, shares: [{ member_id: "mama", amount: 30_000 }] });
  const before = s.balanceOf("card", "visa");

  const r = await recordReimbursement(s.deps, {
    financing_id: id,
    member_id: "mama",
    installment_no: 1,
    paid_on: "2026-11-03",
    channel: "sinpe",
    note: null,
  });
  assert.ok(r.ok);
  assert.equal([...s.state.reimbursementRows.values()][0].amount, 30_000);
  // Control interno: la tarjeta no cambia.
  assert.equal(s.balanceOf("card", "visa"), before);

  const dup = await recordReimbursement(s.deps, {
    financing_id: id,
    member_id: "mama",
    installment_no: 1,
    paid_on: "2026-11-03",
    channel: "efectivo",
    note: null,
  });
  assert.equal(dup.ok, false);
  const noShare = await recordReimbursement(s.deps, {
    financing_id: id,
    member_id: "hermano",
    installment_no: 1,
    paid_on: "2026-11-03",
    channel: "sinpe",
    note: null,
  });
  assert.equal(!noShare.ok && noShare.rule, "F6");

  const remove = await setFinancingShares(s.deps, { financing_id: id, shares: [] });
  assert.equal(!remove.ok && remove.rule, "F7");

  // G5: con historia el miembro se desactiva, no se elimina.
  const del = await removeFromCatalog(s.deps.members, "member", "mama");
  assert.equal(!del.ok && del.rule, "G5");
  assert.ok((await setCatalogActive(s.deps.members, "member", "mama", false)).ok);

  assert.ok((await undoReimbursement(s.deps, r.value.id)).ok);
  assert.ok((await setFinancingShares(s.deps, { financing_id: id, shares: [] })).ok);
});

test("Miembro: nombre único y al menos un medio de aviso", async () => {
  const s = fakeStore({ members: { mama: "Mamá" } });
  const none = await saveMember(s.deps.members, { id: null, fields: { name: "Papá", email: null, phone: null } });
  assert.equal(!none.ok && none.rule, "F8");
  const dup = await saveMember(s.deps.members, {
    id: null,
    fields: { name: "mamá", email: "x@y.cr", phone: null },
  });
  assert.equal(dup.ok, false);
  assert.ok(
    (await saveMember(s.deps.members, { id: null, fields: { name: "Papá", email: null, phone: "50688887777" } })).ok,
  );
});

test("F8: aviso por correo se envía y se registra; sin correo se rechaza", async () => {
  const s = fakeStore();
  const items = [
    { financing_id: "f", member_id: "mama", installment_no: 1, quincenas: 2, channel: "email" as const },
  ];
  const r = await sendNoticeEmail(s.deps, { to: "mama@correo.cr", subject: "Cuota", text: "Hola", items });
  assert.ok(r.ok);
  assert.equal(s.state.sentMail.length, 1);
  assert.equal(s.state.notices.length, 1);

  const noMail = await sendNoticeEmail(s.deps, { to: null, subject: "Cuota", text: "Hola", items });
  assert.equal(!noMail.ok && noMail.rule, "F8");
  assert.ok((await recordNotices(s.deps.notices, [{ ...items[0], channel: "whatsapp" }])).ok);
  assert.equal(s.state.notices.length, 2);
});
