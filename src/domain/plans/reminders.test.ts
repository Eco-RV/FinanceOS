import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReminders } from "./reminders.ts";

test("P8: recordatorios de lo que viene en 3 días y de lo pendiente", () => {
  const list = buildReminders({
    todayISO: "2026-10-19",
    upcoming: [
      { name: "Netflix", kind: "subscription", date: "2026-10-21", amount: 7_000, currency: "CRC" },
      { name: "Salario", kind: "salary", date: "2026-10-30", amount: 500_000, currency: "CRC" },
    ],
    toConfirm: 1,
    noticesToSend: 2,
    minimums: [
      { card: "Visa", remaining: 12_500, currency: "CRC", dueOn: "2026-10-20" },
      { card: "MC", remaining: 0, currency: "CRC", dueOn: "2026-10-20" },
    ],
  });
  assert.deepEqual(
    list.map((r) => r.kind),
    ["confirm", "notice", "minimum", "plan"],
  );
  assert.equal(list[3].title, "Se cobra Netflix");
  assert.equal(buildReminders({ todayISO: "2026-10-19", upcoming: [], toConfirm: 0, noticesToSend: 0, minimums: [] }).length, 0);
});
