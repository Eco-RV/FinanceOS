import assert from "node:assert/strict";
import { test } from "node:test";
import { fromISODate, toISODate } from "../shared/calendar.ts";
import {
  cardStatement,
  lastCutoffDate,
  nextCutoffDate,
  nextPaymentDate,
  type StatementTxn,
} from "./statement.ts";

const d = fromISODate;
const iso = toISODate;
const card = { cutoff_day: 15, payment_due_day: 5 };

test("próximo y último corte", () => {
  assert.equal(iso(nextCutoffDate(15, d("2026-10-11"))), "2026-10-15");
  assert.equal(iso(nextCutoffDate(15, d("2026-10-16"))), "2026-11-15");
  assert.equal(iso(lastCutoffDate(15, d("2026-10-11"))), "2026-09-15");
  assert.equal(iso(lastCutoffDate(15, d("2026-10-15"))), "2026-10-15");
});

test("T5: corte el 31 en meses cortos", () => {
  assert.equal(iso(nextCutoffDate(31, d("2026-02-10"))), "2026-02-28");
});

test("T6: pago ≤ corte cae el mes siguiente; pago > corte, el mismo mes", () => {
  assert.equal(iso(nextPaymentDate(15, 5, d("2026-10-11"))), "2026-11-05");
  assert.equal(iso(nextPaymentDate(5, 25, d("2026-10-01"))), "2026-10-25");
});

const tx = (type: StatementTxn["type"], amount: number, occurred_on: string): StatementTxn => ({
  type,
  amount,
  occurred_on,
});

test("T3/T4: saldo al corte, pago de contado y consumo sin cortar", () => {
  // Hoy 2026-10-11 → último corte 2026-09-15, fecha límite 2026-10-05 (vencida).
  const st = cardStatement(
    card,
    [
      tx("expense", 100_000, "2026-09-01"), // entra al corte
      tx("card_payment", 30_000, "2026-09-10"), // antes del corte
      tx("card_payment", 20_000, "2026-09-20"), // después del corte
      tx("expense", 15_000, "2026-10-01"), // consumo sin cortar
      tx("expense", 5_000, "2026-11-01"), // cuota programada (M7)
    ],
    d("2026-10-11"),
  );
  assert.equal(iso(st.lastCutoff), "2026-09-15");
  assert.equal(iso(st.dueDate), "2026-10-05");
  assert.equal(st.statementBalance, 70_000);
  assert.equal(st.paidAfterCutoff, 20_000);
  assert.equal(st.dueAmount, 50_000);
  assert.equal(st.newCharges, 15_000);
  assert.equal(st.balanceByMovements, 70_000);
  assert.equal(st.status, "atrasada");
  assert.equal(st.daysToDue, -6);
});

test("T7: estados", () => {
  const today = d("2026-09-20"); // último corte 09-15, límite 10-05
  assert.equal(cardStatement(card, [], today).status, "sin-movimientos");
  assert.equal(
    cardStatement(card, [tx("expense", 10, "2026-09-16")], today).status,
    "sin-saldo",
  );
  assert.equal(
    cardStatement(card, [tx("expense", 10, "2026-09-01")], today).status,
    "pendiente",
  );
  assert.equal(
    cardStatement(
      card,
      [tx("expense", 10, "2026-09-01"), tx("card_payment", 10, "2026-09-18")],
      today,
    ).status,
    "al-dia",
  );
});

test("C1: el saldo inicial de la tarjeta cuenta como cargo en su fecha", () => {
  const st = cardStatement(
    card,
    [tx("opening_balance", 80_000, "2026-09-01"), tx("card_payment", 30_000, "2026-09-20")],
    d("2026-09-25"),
  );
  assert.equal(st.statementBalance, 80_000);
  assert.equal(st.dueAmount, 50_000);
  assert.equal(st.status, "pendiente");
});
