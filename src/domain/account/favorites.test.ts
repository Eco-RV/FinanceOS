import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import { DEFAULT_FAVORITES, MAX_FAVORITES, readFavorites, validateFavorites, visibleShortcuts } from "./favorites.ts";

const rule = (id: string) => (e: unknown) => e instanceof DomainError && e.rule === id;

test("favoritos: sin nada guardado, los de por defecto", () => {
  assert.deepEqual(readFavorites(null), [...DEFAULT_FAVORITES]);
  assert.deepEqual(readFavorites({}), [...DEFAULT_FAVORITES]);
  assert.deepEqual(readFavorites({ favorites: "gastos" }), [...DEFAULT_FAVORITES]);
  assert.deepEqual(readFavorites({ favorites: ["nada"] }), [...DEFAULT_FAVORITES]);
});

test("favoritos: lee lo guardado en orden, sin repetidos ni desconocidos y con tope", () => {
  assert.deepEqual(readFavorites({ favorites: ["cobros", "gastos", "cobros", "x"] }), ["cobros", "gastos"]);
  const many = ["gastos", "ingresos", "cuentas", "tarjetas", "transferencias", "cobros", "pendientes"];
  assert.equal(readFavorites({ favorites: many }).length, MAX_FAVORITES);
});

test("favoritos (U11): al menos 1, máximo 5, sin repetir y del catálogo", () => {
  assert.deepEqual(validateFavorites(["pendientes", "gastos"]), ["pendientes", "gastos"]);
  assert.throws(() => validateFavorites([]), rule("U11"));
  assert.throws(() => validateFavorites(["gastos", "ingresos", "cuentas", "tarjetas", "cobros", "pendientes"]), rule("U11"));
  assert.throws(() => validateFavorites(["gastos", "gastos"]), rule("U11"));
  assert.throws(() => validateFavorites(["gastos", "planes"]), rule("U11"));
});

test("favoritos: los de una función apagada no se muestran", () => {
  const hidden = new Set(["/procesos/cobros"]);
  const shown = visibleShortcuts(["gastos", "cobros", "cuentas"], (href) => !hidden.has(href));
  assert.deepEqual(
    shown.map((s) => s.key),
    ["gastos", "cuentas"],
  );
});
