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

test("T3 (2.8.0): con cutoff_day_rolls_over, el día de corte pasa al siguiente corte", () => {
  const txns = [
    tx("expense", 1_000, "2026-10-10"),
    tx("expense", 500, "2026-10-15"), // día de corte
    tx("expense", 200, "2026-10-16"),
  ];
  const today = d("2026-10-16");

  const inclusive = cardStatement(card, txns, today);
  assert.equal(inclusive.statementBalance, 1_500);
  assert.equal(inclusive.newCharges, 200);

  const rolls = cardStatement({ ...card, cutoff_day_rolls_over: true }, txns, today);
  assert.equal(iso(rolls.lastCutoff), "2026-10-15");
  assert.equal(rolls.statementBalance, 1_000);
  assert.equal(rolls.dueAmount, 1_000);
  assert.equal(rolls.newCharges, 700);
  // El mismo día de corte ya cuenta como consumo sin cortar.
  const onCutoff = cardStatement({ ...card, cutoff_day_rolls_over: true }, txns.slice(0, 2), d("2026-10-15"));
  assert.equal(onCutoff.statementBalance, 1_000);
  assert.equal(onCutoff.newCharges, 500);
});

test("abono anticipado: lo pagado de más baja el consumo sin cortar", () => {
  const today = d("2026-10-20");
  // Sin saldo al corte: gastar 20 000 y abonar 20 000 el mismo día deja todo igual.
  const same = cardStatement(
    card,
    [tx("expense", 20_000, "2026-10-18"), tx("card_payment", 20_000, "2026-10-18")],
    today,
  );
  assert.equal(same.dueAmount, 0);
  assert.equal(same.newCharges, 0);
  assert.equal(same.prepaid, 20_000);
  assert.equal(same.balanceByMovements, 0);

  // Primero se cubre el contado; el resto va al consumo sin cortar.
  const split = cardStatement(
    card,
    [
      tx("expense", 50_000, "2026-10-01"),
      tx("expense", 30_000, "2026-10-17"),
      tx("card_payment", 60_000, "2026-10-19"),
    ],
    today,
  );
  assert.equal(split.statementBalance, 50_000);
  assert.equal(split.dueAmount, 0);
  assert.equal(split.prepaid, 10_000);
  assert.equal(split.newCharges, 20_000);

  // Un saldo a favor al corte también se aplica.
  const credit = cardStatement(
    card,
    [tx("card_payment", 5_000, "2026-10-01"), tx("expense", 3_000, "2026-10-17")],
    today,
  );
  assert.equal(credit.statementBalance, 0);
  assert.equal(credit.newCharges, 0);
  assert.equal(credit.prepaid, 3_000);
});
