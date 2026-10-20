import assert from "node:assert/strict";
import { test } from "node:test";
import { compareSpending, spendingFrom, spendingInColones, spendingRanges } from "./spending.ts";

test("G9: los gastos en dólares suman convertidos; sin tipo de cambio quedan fuera", () => {
  const points = [
    { d: "2026-10-01", a: 10_000, c: "Comida", currency: "CRC" as const },
    { d: "2026-10-02", a: 20, c: "Suscripciones", currency: "USD" as const },
  ];
  const conv = spendingInColones(points, 500);
  assert.deepEqual(conv.points.map((p) => p.a), [10_000, 10_000]);
  assert.equal(conv.unconverted, 0);
  const none = spendingInColones(points, null);
  assert.equal(none.points.length, 1);
  assert.equal(none.unconverted, 1);
});

test("G10: períodos equivalentes (semana, mes hasta el mismo día, año hasta el mismo día)", () => {
  const r = spendingRanges("2026-10-20");
  assert.deepEqual(r.week, {
    current: { from: "2026-10-14", to: "2026-10-20" },
    previous: { from: "2026-10-07", to: "2026-10-13" },
  });
  assert.deepEqual(r.month.previous, { from: "2026-09-01", to: "2026-09-20" });
  assert.deepEqual(r.year.previous, { from: "2025-01-01", to: "2025-10-20" });
  // Mes corto: 31 de marzo compara con 1–28 de febrero.
  assert.deepEqual(spendingRanges("2026-03-31").month.previous, { from: "2026-02-01", to: "2026-02-28" });
  assert.equal(spendingFrom("2026-10-20"), "2025-01-01");
});

test("G10: total, anterior y variación (también por categoría)", () => {
  const range = spendingRanges("2026-10-20").month;
  const points = [
    { d: "2026-10-05", a: 30_000, c: "Comida" },
    { d: "2026-10-10", a: 10_000, c: "Gasolina" },
    { d: "2026-09-15", a: 20_000, c: "Comida" },
    { d: "2026-09-25", a: 99_999, c: "Comida" }, // fuera: después del día 20
  ];
  const all = compareSpending(points, range);
  assert.deepEqual(all, { current: 40_000, previous: 20_000, delta: 20_000, ratio: 1 });
  assert.equal(compareSpending(points, range, "Gasolina").ratio, null);
  assert.equal(compareSpending(points, range, "Comida").delta, 10_000);
});
