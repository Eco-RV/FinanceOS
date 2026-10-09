import assert from "node:assert/strict";
import { test } from "node:test";
import { merchantKey } from "./merchants.ts";

test("quita el código de sucursal", () => {
  assert.equal(merchantKey("WALMART GUADALUPE WCN0"), "walmart guadalupe");
});

test("normaliza acentos, puntuación y espacios", () => {
  assert.equal(merchantKey("  Más x Menos*  Escazú  "), "mas x menos escazu");
});

test("no deja la clave vacía si todo lleva dígitos", () => {
  assert.equal(merchantKey("7ELEVEN 123"), "7eleven");
});
