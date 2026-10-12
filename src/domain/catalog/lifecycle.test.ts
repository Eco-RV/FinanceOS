import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertActive,
  assertCanDelete,
  assertCategoryUsable,
  canDelete,
  sameCategoryName,
} from "./lifecycle.ts";
import { DomainError } from "../shared/errors.ts";

function rule(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    assert.ok(e instanceof DomainError);
    return e.rule;
  }
}

test("G5: sin historia se puede eliminar; con historia se rechaza", () => {
  assert.equal(canDelete(0), true);
  assert.equal(canDelete(1), false);
  assert.equal(rule(() => assertCanDelete("account", "BCR", 0)), null);
  assert.equal(rule(() => assertCanDelete("account", "BCR", 3)), "G5");
});

test("G5: el mensaje guía a desactivar, con el género correcto", () => {
  assert.throws(
    () => assertCanDelete("card", "Visa", 1),
    /La tarjeta "Visa" tiene movimientos o financiamientos: desactívala en vez de eliminarla\./,
  );
  assert.throws(
    () => assertCanDelete("bank", "BAC", 2),
    /El banco "BAC" tiene avisos importados: desactívalo en vez de eliminarlo\./,
  );
});

test("G4: rechaza operar sobre algo desactivado", () => {
  assert.equal(rule(() => assertActive("account", "BCR", false)), null);
  assert.throws(() => assertActive("account", "BCR", true), /La cuenta "BCR" está desactivada: actívala primero\./);
  assert.throws(() => assertActive("bank", "BAC", true), /El banco "BAC" está desactivado: actívalo primero\./);
});

test("G4: categoría desactivada se rechaza, salvo que el movimiento ya la tuviera", () => {
  assert.equal(rule(() => assertCategoryUsable({ category: "Comida", deactivated: false })), null);
  assert.equal(rule(() => assertCategoryUsable({ category: null, deactivated: true })), null);
  assert.equal(rule(() => assertCategoryUsable({ category: "Comida", deactivated: true })), "G4");
  assert.equal(
    rule(() => assertCategoryUsable({ category: "Comida", deactivated: true, previous: " comida " })),
    null,
  );
  assert.equal(
    rule(() => assertCategoryUsable({ category: "Comida", deactivated: true, previous: "Ropa" })),
    "G4",
  );
});

test("sameCategoryName ignora mayúsculas y espacios extremos", () => {
  assert.equal(sameCategoryName("Súper ", "súper"), true);
  assert.equal(sameCategoryName("Súper", "Super"), false);
  assert.equal(sameCategoryName(null, ""), true);
});
