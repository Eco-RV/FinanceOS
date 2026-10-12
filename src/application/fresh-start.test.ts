import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeStore } from "./fakes.test-helpers.ts";
import { freshStart } from "./fresh-start.ts";
import { saveMovement } from "./movements.ts";
import { createFinancing } from "./financings.ts";
import { createLoan, payInstallment } from "./loans.ts";
import { setCatalogActive } from "./catalog.ts";

const today = "2026-10-12";

async function seeded() {
  const s = fakeStore({ accounts: { bcr: "CRC", viejo: "CRC" }, cards: { visa: "CRC" } });
  await saveMovement(s.deps, {
    id: null,
    type: "expense",
    amount: 25_000,
    occurred_on: "2026-09-10",
    category: "Comida",
    note: null,
    account_id: "bcr",
    card_id: null,
  });
  await createFinancing(s.deps, {
    card_id: "visa",
    description: "TV",
    category: "Hogar",
    total_amount: 300_000,
    months: 3,
    first_charge_on: "2026-09-05",
  });
  const loan = await createLoan(s.deps, {
    fields: {
      name: "Carro",
      lender: null,
      principal: 600_000,
      annual_rate: 24,
      months: 12,
      currency: "CRC",
      first_payment_on: "2026-10-01",
      account_id: "bcr",
    },
    disbursement: { account_id: "bcr", occurred_on: "2026-09-02" },
  });
  assert.ok(loan.ok);
  await payInstallment(s.deps, { loan_id: loan.value.id, account_id: "bcr", occurred_on: "2026-10-01" });
  await setCatalogActive(s.deps.accounts, "account", "viejo", false);
  return s;
}

const openings = [
  { kind: "account" as const, id: "bcr", currency: "CRC" as const, amount: 300_000 },
  { kind: "card" as const, id: "visa", currency: "CRC" as const, amount: 120_000 },
  { kind: "card" as const, id: "visa", currency: "USD" as const, amount: 0 },
];

test("M8: sin la confirmación no se toca nada", async () => {
  const s = await seeded();
  const before = s.state.movements.size;
  const r = await freshStart(s.deps, { confirmation: "sí", todayISO: today, on: today, openings });
  assert.equal(!r.ok && r.rule, "M8");
  assert.equal(s.state.movements.size, before);
  assert.equal(s.state.freshStarts.length, 0);
});

test("M8: archiva todo, borra cuotas pendientes y planes, y deja solo los saldos nuevos", async () => {
  const s = await seeded();
  // gasto + 3 cuotas (1 futura) + desembolso + 1 pago de préstamo = 6
  assert.equal(s.state.movements.size, 6);

  const r = await freshStart(s.deps, { confirmation: "arrancar", todayISO: today, on: today, openings });
  assert.deepEqual(r, { ok: true, value: { archived: 5, openings: 2 } });

  const all = [...s.state.movements.values()];
  const visible = all.filter((m) => !m.archived);
  assert.deepEqual(
    visible.map((m) => [m.type, m.account_id ?? m.card_id, m.currency, m.amount, m.occurred_on]),
    [
      ["opening_balance", "bcr", "CRC", 300_000, today],
      ["opening_balance", "visa", "CRC", 120_000, today],
    ],
  );
  // La cuota de noviembre (pendiente) se borró; las cobradas quedan archivadas y sueltas.
  assert.equal(all.filter((m) => m.archived).length, 5);
  assert.ok(all.every((m) => !m.financing_id && !m.loan_id));
  assert.equal(s.state.financings.size, 0);
  assert.equal(s.state.loanRows.size, 0);

  // Los saldos quedan exactamente en lo digitado.
  assert.equal(s.balanceOf("account", "bcr"), 300_000);
  assert.equal(s.balanceOf("card", "visa", "CRC"), 120_000);
  assert.equal(s.balanceOf("card", "visa", "USD"), 0);
  assert.deepEqual(s.state.freshStarts, [{ on: today, archived: 5 }]);
});

test("M8: exige saldo para cada cuenta y tarjeta activa (no para las desactivadas)", async () => {
  const s = await seeded();
  const r = await freshStart(s.deps, {
    confirmation: "ARRANCAR",
    todayISO: today,
    on: today,
    openings: openings.slice(0, 2),
  });
  assert.match(!r.ok ? r.message : "", /Falta el saldo inicial de "visa" en USD/);

  const withInactive = await freshStart(s.deps, {
    confirmation: "ARRANCAR",
    todayISO: today,
    on: today,
    openings: [...openings, { kind: "account", id: "viejo", currency: "CRC", amount: 1 }],
  });
  assert.equal(!withInactive.ok && withInactive.rule, "M8");
});
