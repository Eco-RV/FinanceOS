import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeStore } from "./fakes.test-helpers.ts";
import {
  changeLoanRate,
  createLoan,
  payInstallment,
  prepayLoan,
  renameLoan,
  termsOf,
  undoLastInstallment,
  undoLastLoanAdjustment,
} from "./loans.ts";
import { loanProgress } from "../domain/index.ts";
import { removeFromCatalog, setCatalogActive } from "./catalog.ts";
import { deleteMovement, saveMovement } from "./movements.ts";
import type { LoanFields } from "./ports.ts";

const fields: LoanFields = {
  name: "Carro",
  lender: "BCR",
  principal: 600_000,
  annual_rate: 24,
  months: 12,
  currency: "CRC",
  first_payment_on: "2026-11-01",
  account_id: "bcr",
};

async function withLoan(disburse = false) {
  const s = fakeStore({ accounts: { bcr: "CRC", usd: "USD" } });
  const r = await createLoan(s.deps, {
    fields,
    disbursement: disburse ? { account_id: "bcr", occurred_on: "2026-10-12" } : null,
  });
  assert.ok(r.ok);
  return { s, id: r.value.id };
}

const pay = (s: ReturnType<typeof fakeStore>, loan_id: string, occurred_on = "2026-11-01") =>
  payInstallment(s.deps, { loan_id, account_id: "bcr", occurred_on });

test("createLoan: sin desembolso no toca saldos", async () => {
  const { s, id } = await withLoan();
  assert.equal(s.state.loanRows.get(id)!.name, "Carro");
  assert.equal(s.state.movements.size, 0);
});

test("createLoan: el desembolso es un ingreso en la cuenta", async () => {
  const { s, id } = await withLoan(true);
  const [m] = [...s.state.movements.values()];
  assert.equal(m.type, "income");
  assert.equal(m.loan_id, id);
  assert.equal(m.installment_no, undefined);
  assert.equal(s.balanceOf("account", "bcr"), 600_000);
});

test("createLoan: L1 y G3 (cuenta en otra moneda) se rechazan", async () => {
  const s = fakeStore({ accounts: { bcr: "CRC", usd: "USD" } });
  const bad = await createLoan(s.deps, { fields: { ...fields, months: 0 } });
  assert.equal(!bad.ok && bad.rule, "L1");
  const usd = await createLoan(s.deps, {
    fields,
    disbursement: { account_id: "usd", occurred_on: "2026-10-12" },
  });
  assert.equal(!usd.ok && usd.rule, "G3");
  assert.equal(s.state.loanRows.size, 0);
});

test("payInstallment: paga en orden, con desglose, por el monto de la cuota", async () => {
  const { s, id } = await withLoan();
  const first = await pay(s, id);
  assert.deepEqual(first, { ok: true, value: { installmentNo: 1, amount: 56_735.76 } });
  const second = await pay(s, id, "2026-12-03");
  assert.ok(second.ok && second.value.installmentNo === 2);

  const payments = [...s.state.movements.values()];
  assert.deepEqual(payments.map((m) => [m.type, m.installment_no, m.occurred_on]), [
    ["expense", 1, "2026-11-01"],
    ["expense", 2, "2026-12-03"],
  ]);
  assert.match(payments[0].note!, /Carro · cuota 1\/12 \(interés 12000\.00 · capital 44735\.76\)/);
  assert.equal(s.balanceOf("account", "bcr"), -113_471.52);
});

test("L3: no se paga una cuota más de las que tiene", async () => {
  const s = fakeStore({ accounts: { bcr: "CRC" } });
  const r = await createLoan(s.deps, { fields: { ...fields, months: 1 } });
  assert.ok(r.ok);
  assert.ok((await pay(s, r.value.id)).ok);
  const again = await pay(s, r.value.id);
  assert.equal(!again.ok && again.rule, "L3");
});

test("G4: no se paga desde una cuenta desactivada ni en otra moneda", async () => {
  const { s, id } = await withLoan();
  const usd = await payInstallment(s.deps, { loan_id: id, account_id: "usd", occurred_on: "2026-11-01" });
  assert.equal(!usd.ok && usd.rule, "G3");
  await setCatalogActive(s.deps.accounts, "account", "bcr", false);
  const off = await pay(s, id);
  assert.equal(!off.ok && off.rule, "G4");
});

test("L5: deshacer quita solo la última cuota pagada", async () => {
  const { s, id } = await withLoan();
  await pay(s, id);
  await pay(s, id);
  const undo = await undoLastInstallment(s.deps, id);
  assert.deepEqual(undo, { ok: true, value: { installmentNo: 2 } });
  assert.deepEqual([...s.state.movements.values()].map((m) => m.installment_no), [1]);
  await undoLastInstallment(s.deps, id);
  const none = await undoLastInstallment(s.deps, id);
  assert.equal(!none.ok && none.rule, "L5");
});

test("L2: un pago de préstamo no se edita ni se borra desde Gastos", async () => {
  const { s, id } = await withLoan();
  await pay(s, id);
  const [movementId] = [...s.state.movements.keys()];
  const del = await deleteMovement(s.deps, movementId);
  assert.equal(!del.ok && del.rule, "L2");
  const edit = await saveMovement(s.deps, {
    id: movementId,
    type: "expense",
    amount: 1,
    occurred_on: "2026-11-01",
    category: "Préstamos",
    note: null,
    account_id: "bcr",
    card_id: null,
  });
  assert.equal(!edit.ok && edit.rule, "L2");
  assert.equal(s.state.movements.size, 1);
});

test("G5: un préstamo con cuotas pagadas no se elimina; sin pagos sí (con su desembolso)", async () => {
  const { s, id } = await withLoan(true);
  await pay(s, id);
  const r = await removeFromCatalog(s.deps.loans, "loan", id);
  assert.match(!r.ok ? r.message : "", /El préstamo "Carro" tiene cuotas pagadas: desactívalo/);

  await undoLastInstallment(s.deps, id);
  assert.ok((await removeFromCatalog(s.deps.loans, "loan", id)).ok);
  assert.equal(s.state.movements.size, 0);
  assert.equal(s.balanceOf("account", "bcr"), 0);
});

test("G4: un préstamo desactivado no se paga ni se renombra", async () => {
  const { s, id } = await withLoan();
  await setCatalogActive(s.deps.loans, "loan", id, false);
  const r = await pay(s, id);
  assert.equal(!r.ok && r.rule, "G4");
  const ren = await renameLoan(s.deps, { id, name: "X", lender: null, account_id: null });
  assert.equal(!ren.ok && ren.rule, "G4");
});

test("renameLoan cambia nombre y cuenta sugerida, no los términos", async () => {
  const { s, id } = await withLoan();
  assert.ok((await renameLoan(s.deps, { id, name: "Carro 2", lender: null, account_id: null })).ok);
  const loan = s.state.loanRows.get(id)!;
  assert.deepEqual([loan.name, loan.lender, loan.account_id, loan.principal], ["Carro 2", null, null, 600_000]);
});

test("L7: abono extraordinario que baja el plazo; el gasto sale de la cuenta", async () => {
  const { s, id } = await withLoan();
  assert.ok((await pay(s, id)).ok);
  const r = await prepayLoan(s.deps, {
    loan_id: id,
    account_id: "bcr",
    amount: 200_000,
    mode: "term",
    occurred_on: "2026-11-10",
    today: "2026-11-10",
  });
  assert.ok(r.ok);
  assert.ok(r.value.remainingInstallments < 11);
  const prepay = [...s.state.movements.values()].find((m) => m.installment_no == null)!;
  assert.equal(prepay.type, "expense");
  assert.equal(prepay.loan_id, id);
  assert.equal(prepay.amount, 200_000);

  // El capital que falta baja por el abono.
  const adjustments = (await s.deps.loans.adjustments(id)).map((a) => a.event);
  const p = loanProgress(termsOf({ ...fields, currency: "CRC" }, adjustments), [1], "2026-11-10");
  assert.ok(Math.abs(p.remainingPrincipal - (555_264.24 - 200_000)) < 0.01);

  // L2: no se borra desde Gastos; L5: no se deshace la cuota 1 sin deshacer el abono.
  const movementId = [...s.state.movements.entries()].find(([, m]) => m.installment_no == null)![0];
  assert.equal((await deleteMovement(s.deps, movementId)).ok, false);
  const undoCuota = await undoLastInstallment(s.deps, id);
  assert.equal(!undoCuota.ok && undoCuota.rule, "L5");

  assert.ok((await undoLastLoanAdjustment(s.deps, id)).ok);
  assert.equal([...s.state.movements.values()].filter((m) => m.installment_no == null).length, 0);
  assert.ok((await undoLastInstallment(s.deps, id)).ok);
});

test("L7: el abono no pasa el capital que falta", async () => {
  const { s, id } = await withLoan();
  const r = await prepayLoan(s.deps, {
    loan_id: id,
    account_id: "bcr",
    amount: 700_000,
    mode: "payment",
    occurred_on: "2026-10-20",
    today: "2026-10-20",
  });
  assert.equal(!r.ok && r.rule, "L7");
  const usd = await prepayLoan(s.deps, {
    loan_id: id,
    account_id: "usd",
    amount: 100,
    mode: "payment",
    occurred_on: "2026-10-20",
    today: "2026-10-20",
  });
  assert.equal(usd.ok, false);
});

test("L8: tasa variable desde una cuota sin pagar; la próxima cuota se paga con la nueva", async () => {
  const { s, id } = await withLoan();
  await pay(s, id);
  const past = await changeLoanRate(s.deps, { loan_id: id, from_no: 1, annual_rate: 12, occurred_on: "2026-11-02", today: "2026-11-02" });
  assert.equal(!past.ok && past.rule, "L8");
  const r = await changeLoanRate(s.deps, { loan_id: id, from_no: 2, annual_rate: 12, occurred_on: "2026-11-02", today: "2026-11-02" });
  assert.ok(r.ok);
  assert.ok(r.value.payment < 56_735.76);
  const second = await pay(s, id, "2026-12-01");
  assert.ok(second.ok);
  assert.equal(second.value.amount, r.value.payment);
});
