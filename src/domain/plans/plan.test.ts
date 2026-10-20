import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import {
  baseline,
  dueOccurrences,
  monthlyEquivalent,
  suggestFixedCategory,
  occurrencesBetween,
  upcomingOccurrences,
  validateBaselineCap,
  validatePlan,
  type PlanTerms,
} from "./plan.ts";

const rule = (id: string) => (e: unknown) => e instanceof DomainError && e.rule === id;

const base: PlanTerms = {
  kind: "salary",
  amount: 500_000,
  currency: "CRC",
  frequency: "monthly",
  startsOn: "2026-01-31",
  endsOn: null,
  accountId: "a1",
  cardId: null,
};

test("P1/P2/T9/P5: forma de cada plan", () => {
  assert.doesNotThrow(() => validatePlan(base));
  assert.throws(() => validatePlan({ ...base, accountId: null }), rule("P1"));
  assert.throws(() => validatePlan({ ...base, kind: "insurance", accountId: null, cardId: null }), rule("T9"));
  // T9 (3.1.0): también con la tarjeta de débito de una cuenta, pero no desde la cuenta sola.
  assert.doesNotThrow(() => validatePlan({ ...base, kind: "insurance", frequency: "monthly", debitCardId: "d1" }));
  assert.throws(() => validatePlan({ ...base, kind: "insurance", frequency: "monthly" }), rule("T9"));
  assert.throws(
    () => validatePlan({ ...base, kind: "insurance", frequency: "monthly", cardId: "c1", debitCardId: "d1" }),
    rule("T9"),
  );
  assert.throws(() => validatePlan({ ...base, debitCardId: "d1" }), rule("P2"));
  assert.throws(
    () => validatePlan({ ...base, kind: "subscription", frequency: "weekly", accountId: null, cardId: "c1" }),
    rule("P2"),
  );
  assert.throws(() => validatePlan({ ...base, kind: "subscription", cardId: "c1" }), rule("P2"));
  assert.doesNotThrow(() => validatePlan({ ...base, kind: "subscription", accountId: null, cardId: "c1" }));
  assert.throws(() => validatePlan({ ...base, amount: 0 }), rule("P5"));
  assert.throws(() => validatePlan({ ...base, endsOn: "2025-12-01" }), rule("P5"));
});

test("mensual: mismo día cada mes, recortado en meses cortos (sin arrastrar)", () => {
  assert.deepEqual(occurrencesBetween(base, null, "2026-05-15"), [
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
    "2026-04-30",
  ]);
});

test("quincenal: 15 y último día; semanal y bisemanal desde el inicio", () => {
  assert.deepEqual(
    occurrencesBetween({ frequency: "semimonthly", startsOn: "2026-02-10", endsOn: null }, null, "2026-03-20"),
    ["2026-02-15", "2026-02-28", "2026-03-15"],
  );
  assert.deepEqual(
    occurrencesBetween({ frequency: "weekly", startsOn: "2026-10-02", endsOn: null }, null, "2026-10-20"),
    ["2026-10-02", "2026-10-09", "2026-10-16"],
  );
  assert.deepEqual(
    occurrencesBetween({ frequency: "biweekly", startsOn: "2026-10-02", endsOn: null }, null, "2026-11-10"),
    ["2026-10-02", "2026-10-16", "2026-10-30"],
  );
});

test("M7: solo se registra lo que ya llegó, sin repetir lo registrado", () => {
  assert.deepEqual(dueOccurrences(base, "2026-02-28", "2026-04-30"), ["2026-03-31", "2026-04-30"]);
  assert.deepEqual(dueOccurrences(base, "2026-04-30", "2026-05-29"), []);
  assert.deepEqual(upcomingOccurrences(base, "2026-04-30", "2026-07-01"), ["2026-05-31", "2026-06-30"]);
});

test("la fecha final corta el plan", () => {
  assert.deepEqual(occurrencesBetween({ ...base, endsOn: "2026-03-15" }, null, "2026-12-31"), [
    "2026-01-31",
    "2026-02-28",
  ]);
});

test("equivalente mensual por frecuencia", () => {
  assert.equal(monthlyEquivalent(100_000, "weekly"), 433_333.33);
  assert.equal(monthlyEquivalent(100_000, "biweekly"), 216_666.67);
  assert.equal(monthlyEquivalent(250_000, "semimonthly"), 500_000);
  assert.equal(monthlyEquivalent(500_000, "monthly"), 500_000);
});

test("P4: línea base contra el tope del salario", () => {
  const b = baseline(
    [{ amount: 250_000, frequency: "semimonthly" }],
    [
      { name: "Netflix", source: "subscription", monthly: 7_000 },
      { name: "Préstamo carro", source: "loan", monthly: 180_000 },
    ],
  );
  assert.equal(b.monthlyIncome, 500_000);
  assert.equal(b.monthlyFixed, 187_000);
  assert.equal(b.items[0].name, "Préstamo carro");
  assert.equal(b.items[0].share, 0.36);
  assert.equal(b.overCap, true);
  assert.equal(b.perPeriod.fortnight, 93_500);

  assert.equal(baseline([], [{ name: "x", source: "subscription", monthly: 1 }]).ratio, null);
  assert.equal(baseline([{ amount: 1_000_000, frequency: "monthly" }], [], 35).overCap, false);
});

test("P4: el tope va de 1 a 100", () => {
  assert.equal(validateBaselineCap(40), 40);
  assert.throws(() => validateBaselineCap(0), rule("P4"));
  assert.throws(() => validateBaselineCap(150), rule("P4"));
});

test("gasto fijo: categoría sugerida por el nombre", () => {
  assert.equal(suggestFixedCategory("Alquiler apartamento"), "Vivienda");
  assert.equal(suggestFixedCategory("Luz (CNFL)"), "Servicios");
  assert.equal(suggestFixedCategory("Internet Kölbi"), "Servicios");
  assert.equal(suggestFixedCategory("Netflix"), "Suscripciones");
  assert.equal(suggestFixedCategory("Pensión"), null);
});
