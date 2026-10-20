import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import {
  assertCanUnshare,
  assertKeepsPaidParts,
  defaultSharedDueDate,
  sharedDueDate,
  sharedNoticeGroups,
  sharedReceivables,
  splitByPercent,
  suggestPercents,
  suggestSplit,
  validateSharedParts,
  type SharedPart,
} from "./shared-expense.ts";

const rule = (id: string) => (e: unknown) => e instanceof DomainError && e.rule === id;

test("X2: partes iguales con el residuo en la última parte", () => {
  // ₡100 entre 2 personas y yo: 33,33 + 33,33 y yo 33,34.
  assert.deepEqual(suggestSplit(100, ["ana", "beto"], true), [
    { member_id: "ana", amount: 33.33 },
    { member_id: "beto", amount: 33.33 },
  ]);
  // Sin mí, el residuo va a la última persona.
  assert.deepEqual(suggestSplit(100, ["ana", "beto", "cata"], false), [
    { member_id: "ana", amount: 33.33 },
    { member_id: "beto", amount: 33.33 },
    { member_id: "cata", amount: 33.34 },
  ]);
  assert.deepEqual(suggestSplit(0, ["ana"], true), [{ member_id: "ana", amount: 0 }]);
});

test("X2: valida las partes y devuelve la del usuario", () => {
  assert.deepEqual(validateSharedParts(30_000, [{ member_id: "ana", amount: 10_000 }]), { own: 20_000 });
  assert.deepEqual(
    validateSharedParts(30_000, [
      { member_id: "ana", amount: 15_000 },
      { member_id: "beto", amount: 15_000 },
    ]),
    { own: 0 },
  );
  assert.throws(() => validateSharedParts(30_000, []), rule("X2"));
  assert.throws(() => validateSharedParts(30_000, [{ member_id: "ana", amount: 0 }]), rule("X2"));
  assert.throws(
    () =>
      validateSharedParts(30_000, [
        { member_id: "ana", amount: 1 },
        { member_id: "ana", amount: 1 },
      ]),
    rule("X2"),
  );
  assert.throws(() => validateSharedParts(30_000, [{ member_id: "ana", amount: 30_000.01 }]), rule("X2"));
});

test("X3: con tarjeta, la fecha de pago del corte; si no, la elegida", () => {
  const card = { cutoff_day: 15, payment_due_day: 30 };
  assert.equal(sharedDueDate({ occurred_on: "2026-10-10", card, chosen: null }), "2026-10-30");
  // Pasado el corte, entra al siguiente estado de cuenta.
  assert.equal(sharedDueDate({ occurred_on: "2026-10-16", card, chosen: null }), "2026-11-30");
  // T3: el día del corte pasa al siguiente si la tarjeta lo indica.
  assert.equal(sharedDueDate({ occurred_on: "2026-10-15", card, chosen: null }), "2026-10-30");
  assert.equal(
    sharedDueDate({ occurred_on: "2026-10-15", card: { ...card, cutoff_day_rolls_over: true }, chosen: null }),
    "2026-11-30",
  );
  assert.equal(sharedDueDate({ occurred_on: "2026-10-10", card: null, chosen: "2026-10-25" }), "2026-10-25");
  assert.throws(() => sharedDueDate({ occurred_on: "2026-10-10", card: null, chosen: null }), rule("X3"));
  assert.throws(() => sharedDueDate({ occurred_on: "2026-10-10", card: null, chosen: "2026-10-01" }), rule("X3"));
  assert.equal(defaultSharedDueDate("2026-10-20"), "2026-11-04");
});

test("X6: no se cambia la parte de quien pagó ni se deja de compartir con pagos", () => {
  const before = [
    { member_id: "ana", amount: 10, paid_on: "2026-10-12" },
    { member_id: "beto", amount: 10, paid_on: null },
  ];
  assert.doesNotThrow(() => assertKeepsPaidParts(before, [{ member_id: "ana", amount: 10 }]));
  assert.throws(() => assertKeepsPaidParts(before, [{ member_id: "beto", amount: 10 }]), rule("X6"));
  assert.throws(() => assertKeepsPaidParts(before, [{ member_id: "ana", amount: 12 }]), rule("X6"));
  assert.throws(() => assertCanUnshare(before), rule("X6"));
  assert.doesNotThrow(() => assertCanUnshare([{ member_id: "beto", amount: 10, paid_on: null }]));
});

const part = (p: Partial<SharedPart>): SharedPart => ({
  shared_expense_id: "s1",
  member_id: "ana",
  amount: 5_000,
  currency: "CRC",
  occurred_on: "2026-10-10",
  due_on: "2026-12-30",
  paid_on: null,
  ...p,
});

test("X5: se avisa desde el día 1 y una vez por tramo", () => {
  const parts = [
    part({}),
    part({ shared_expense_id: "s2", amount: 2_500 }),
    part({ member_id: "beto", paid_on: "2026-10-11" }),
  ];
  const [g] = sharedNoticeGroups(parts, [], "2026-10-18");
  // Más de 3 quincenas: tramo 4, se agrupan las dos partes de Ana con la misma fecha.
  assert.equal(g.quincenas, 4);
  assert.equal(g.total, 7_500);
  assert.equal(g.needsNotice, true);

  const sent = [
    { shared_expense_id: "s1", member_id: "ana", quincenas: 4, sent_at: "2026-10-18T10:00:00Z" },
    { shared_expense_id: "s2", member_id: "ana", quincenas: 4, sent_at: "2026-10-18T10:00:00Z" },
  ];
  assert.equal(sharedNoticeGroups(parts, sent, "2026-10-18")[0].needsNotice, false);
  // Al entrar a 3 quincenas, toca avisar de nuevo.
  const later = sharedNoticeGroups(parts, sent, "2026-11-20")[0];
  assert.equal(later.quincenas, 3);
  assert.equal(later.needsNotice, true);
});

test("Por cobrar: partes sin pagar de gastos ya ocurridos", () => {
  const parts = [part({}), part({ paid_on: "2026-10-12", shared_expense_id: "s2" }), part({ occurred_on: "2026-11-01" })];
  const [r] = sharedReceivables(parts, "2026-10-18");
  assert.equal(r.total, 5_000);
  assert.equal(r.parts.length, 1);
});

test("X7: reparto por porcentaje; los céntimos sobrantes quedan al usuario", () => {
  assert.deepEqual(splitByPercent(100, [{ member_id: "ana", percent: 33.33 }, { member_id: "beto", percent: 33.33 }]), [
    { member_id: "ana", amount: 33.33 },
    { member_id: "beto", amount: 33.33 },
  ]);
  assert.deepEqual(splitByPercent(30_000, [{ member_id: "ana", percent: 50 }]), [{ member_id: "ana", amount: 15_000 }]);
  assert.throws(() => splitByPercent(100, [{ member_id: "a", percent: 60 }, { member_id: "b", percent: 41 }]), rule("X7"));
  assert.throws(() => splitByPercent(100, [{ member_id: "a", percent: 0 }]), rule("X7"));
  assert.deepEqual(suggestPercents(["a", "b"], true), [
    { member_id: "a", percent: 33.33 },
    { member_id: "b", percent: 33.33 },
  ]);
  assert.deepEqual(suggestPercents(["a"], false), [{ member_id: "a", percent: 100 }]);
});
