import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import { goalProgress, validateGoal } from "./goal.ts";

const rule = (id: string) => (e: unknown) => e instanceof DomainError && e.rule === id;

test("A2: nombre, objetivo positivo y fecha futura al crear", () => {
  assert.doesNotThrow(() => validateGoal({ name: "Viaje", targetAmount: 500_000, targetDate: "2027-06-01" }, "2026-10-14", true));
  assert.throws(() => validateGoal({ name: " ", targetAmount: 1, targetDate: null }, "2026-10-14", true), rule("A2"));
  assert.throws(() => validateGoal({ name: "x", targetAmount: 0, targetDate: null }, "2026-10-14", true), rule("A2"));
  assert.throws(
    () => validateGoal({ name: "x", targetAmount: 1, targetDate: "2026-10-01" }, "2026-10-14", true),
    rule("A2"),
  );
  // Al editar una meta vieja se puede dejar su fecha pasada.
  assert.doesNotThrow(() => validateGoal({ name: "x", targetAmount: 1, targetDate: "2026-10-01" }, "2026-10-14", false));
});

test("A3: avance, aporte mensual y estado", () => {
  const p = goalProgress({ targetAmount: 600_000, saved: 150_000, targetDate: "2027-04-14", today: "2026-10-14" });
  assert.equal(p.ratio, 0.25);
  assert.equal(p.remaining, 450_000);
  assert.equal(p.monthsLeft, 6);
  assert.equal(p.monthlyNeeded, 75_000);
  assert.equal(p.status, "en-camino");

  assert.equal(goalProgress({ targetAmount: 100, saved: 120, targetDate: null, today: "2026-10-14" }).status, "lograda");
  assert.equal(goalProgress({ targetAmount: 100, saved: -50, targetDate: null, today: "2026-10-14" }).ratio, 0);
  const late = goalProgress({ targetAmount: 100, saved: 40, targetDate: "2026-09-01", today: "2026-10-14" });
  assert.equal(late.status, "atrasada");
  assert.equal(late.monthlyNeeded, 60);
});
