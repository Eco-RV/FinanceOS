import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import {
  chargeDueDate,
  installmentParts,
  memberParts,
  memberReceivables,
  noticeGroups,
  quincenasLeft,
  validateShares,
} from "./members.ts";

test("F6: la suma de partes no pasa la cuota más baja; el resto es del usuario", () => {
  const cuotas = [{ amount: 50_000 }, { amount: 49_999.99 }];
  validateShares([{ member_id: "a", amount: 20_000 }, { member_id: "b", amount: 29_999.99 }], cuotas);
  assert.throws(
    () => validateShares([{ member_id: "a", amount: 50_000 }], cuotas),
    DomainError,
  );
  assert.throws(() => validateShares([{ member_id: "a", amount: 0 }], cuotas), DomainError);
  assert.throws(
    () => validateShares([{ member_id: "a", amount: 1 }, { member_id: "a", amount: 1 }], cuotas),
    DomainError,
  );
  const parts = installmentParts(50_000, [
    { member_id: "a", amount: 20_000 },
    { member_id: "b", amount: 15_000.5 },
  ]);
  assert.equal(parts.own, 14_999.5);
});

test("Fecha límite del estado de cuenta en que cae un cargo", () => {
  const cycle = { cutoff_day: 20, payment_due_day: 5 };
  assert.equal(chargeDueDate(cycle, "2026-10-20"), "2026-11-05");
  assert.equal(chargeDueDate(cycle, "2026-10-21"), "2026-12-05");
  assert.equal(chargeDueDate({ cutoff_day: 1, payment_due_day: 25 }, "2026-10-01"), "2026-10-25");
});

test("F8: quincenas que faltan (1, 2, 3; 0 si venció)", () => {
  assert.equal(quincenasLeft("2026-10-14", "2026-10-14"), 1);
  assert.equal(quincenasLeft("2026-10-29", "2026-10-14"), 1);
  assert.equal(quincenasLeft("2026-10-30", "2026-10-14"), 2);
  assert.equal(quincenasLeft("2026-11-28", "2026-10-14"), 3);
  assert.equal(quincenasLeft("2026-11-29", "2026-10-14"), 4);
  assert.equal(quincenasLeft("2026-10-13", "2026-10-14"), 0);
});

const plan = {
  id: "f1",
  cycle: { cutoff_day: 20, payment_due_day: 5 },
  installments: [
    { no: 1, occurred_on: "2026-10-10" },
    { no: 2, occurred_on: "2026-11-10" },
    { no: 3, occurred_on: "2026-12-10" },
  ],
  shares: [
    { member_id: "mama", amount: 20_000 },
    { member_id: "hermano", amount: 10_000 },
  ],
};

test("F7/F8: partes, por cobrar y avisos agrupados por miembro y fecha", () => {
  const parts = memberParts(
    [plan],
    [{ id: "r1", financing_id: "f1", member_id: "hermano", installment_no: 1, paid_on: "2026-10-12", amount: 10_000 }],
  );
  assert.equal(parts.length, 6);
  assert.equal(parts[0].due_on, "2026-11-05");

  const owed = memberReceivables(parts, "2026-10-14");
  assert.deepEqual(
    owed.map((r) => [r.member_id, r.currency, r.total]),
    [["mama", "CRC", 20_000]],
  );

  // Hoy 14/10: la cuota 1 vence el 05/11 (2 quincenas); la 2, el 05/12 (4: todavía no).
  const groups = noticeGroups(parts, [], "2026-10-14");
  assert.deepEqual(
    groups.map((g) => [g.member_id, g.due_on, g.quincenas, g.total, g.needsNotice]),
    [["mama", "2026-11-05", 2, 20_000, true]],
  );

  const sent = [
    { financing_id: "f1", member_id: "mama", installment_no: 1, quincenas: 2, sent_at: "2026-10-14T15:00:00Z" },
  ];
  const after = noticeGroups(parts, sent, "2026-10-14");
  assert.equal(after[0].needsNotice, false);
  assert.equal(after[0].lastSentAt, "2026-10-14T15:00:00Z");
  // En la siguiente quincena vuelve a tocar avisar.
  assert.equal(noticeGroups(parts, sent, "2026-10-25")[0].needsNotice, true);
});

test("T3: con 'pasa al siguiente corte', una cuota del día de corte vence en el corte siguiente", () => {
  const cycle = { cutoff_day: 15, payment_due_day: 30 };
  assert.equal(chargeDueDate(cycle, "2026-10-15"), "2026-10-30");
  assert.equal(chargeDueDate({ ...cycle, cutoff_day_rolls_over: true }, "2026-10-15"), "2026-11-30");
  // Un día antes del corte no cambia.
  assert.equal(chargeDueDate({ ...cycle, cutoff_day_rolls_over: true }, "2026-10-14"), "2026-10-30");
  // Mes corto: corte 31 recortado al 30 de noviembre.
  assert.equal(
    chargeDueDate({ cutoff_day: 31, payment_due_day: 20, cutoff_day_rolls_over: true }, "2026-11-30"),
    "2027-01-20",
  );
});
