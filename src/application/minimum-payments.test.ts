import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeStore } from "./fakes.test-helpers.ts";
import { setMinimumPayment } from "./minimum-payments.ts";
import type { MinimumPayment, MinimumPaymentRepository } from "./ports.ts";

function repo() {
  const rows = new Map<string, MinimumPayment>();
  const key = (m: Omit<MinimumPayment, "amount">) => `${m.card_id}:${m.cutoff_on}:${m.currency}`;
  const minimumPayments: MinimumPaymentRepository = {
    async save(m) {
      rows.set(key(m), m);
    },
    async delete(k) {
      rows.delete(key(k));
    },
  };
  return { rows, minimumPayments };
}

test("T8: guarda, valida y borra el pago mínimo del corte", async () => {
  const s = fakeStore({ cards: { visa: "CRC" } });
  const m = repo();
  const deps = { cards: s.deps.cards, minimumPayments: m.minimumPayments };
  const base = { card_id: "visa", cutoff_on: "2026-10-15", currency: "CRC" as const };

  assert.ok((await setMinimumPayment(deps, { ...base, amount: 12_500, statementBalance: 250_000 })).ok);
  assert.equal(m.rows.size, 1);

  const tooBig = await setMinimumPayment(deps, { ...base, amount: 300_000, statementBalance: 250_000 });
  assert.equal(!tooBig.ok && tooBig.rule, "T8");

  assert.ok((await setMinimumPayment(deps, { ...base, amount: 0, statementBalance: 250_000 })).ok);
  assert.equal(m.rows.size, 0);

  const missing = await setMinimumPayment(deps, { ...base, card_id: "nope", amount: 1, statementBalance: 10 });
  assert.equal(missing.ok, false);
});
