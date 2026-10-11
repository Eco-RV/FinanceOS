import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addMonthsClamped,
  crToday,
  daysUntil,
  fromISODate,
  toISODate,
} from "./calendar.ts";

test("crToday usa el día de Costa Rica, no el del servidor", () => {
  // 2026-10-12 03:00 UTC = 2026-10-11 21:00 en Costa Rica.
  assert.equal(toISODate(crToday(new Date("2026-10-12T03:00:00Z"))), "2026-10-11");
  assert.equal(toISODate(crToday(new Date("2026-10-12T07:00:00Z"))), "2026-10-12");
});

test("ISODate ida y vuelta", () => {
  assert.equal(toISODate(fromISODate("2026-02-28")), "2026-02-28");
});

test("T5: addMonthsClamped ajusta a meses cortos sin arrastrar el ajuste", () => {
  const jan31 = fromISODate("2026-01-31");
  assert.equal(toISODate(addMonthsClamped(jan31, 1)), "2026-02-28");
  assert.equal(toISODate(addMonthsClamped(jan31, 2)), "2026-03-31");
  assert.equal(toISODate(addMonthsClamped(fromISODate("2026-11-30"), 3)), "2027-02-28");
});

test("daysUntil cuenta días de calendario", () => {
  const from = fromISODate("2026-10-11");
  assert.equal(daysUntil(fromISODate("2026-10-11"), from), 0);
  assert.equal(daysUntil(fromISODate("2026-10-16"), from), 5);
  assert.equal(daysUntil(fromISODate("2026-10-09"), from), -2);
});
