import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import {
  assertValidAvatar,
  assertValidPassword,
  initialsOf,
  normalizeNewEmail,
  normalizeUsername,
  validateProfile,
  assertDeleteConfirmation,
  readPreferences,
} from "./profile.ts";

const rule = (id: string) => (e: unknown) => e instanceof DomainError && e.rule === id;

test("perfil: todo opcional; limpia espacios y normaliza usuario y país", () => {
  assert.deepEqual(validateProfile({ full_name: "  Oswald   Reid ", username: " @Oswald.R ", country: "cr" }), {
    full_name: "Oswald Reid",
    username: "oswald.r",
    country: "CR",
  });
  assert.deepEqual(validateProfile({ full_name: " ", username: "", country: null }), {
    full_name: null,
    username: null,
    country: null,
  });
});

test("U1: usuario de 3 a 30, sin signos al inicio o al final", () => {
  assert.equal(normalizeUsername("@@Ana_9"), "ana_9");
  assert.throws(() => validateProfile({ full_name: null, username: "ab", country: null }), rule("U1"));
  assert.throws(() => validateProfile({ full_name: null, username: ".ana", country: null }), rule("U1"));
  assert.throws(() => validateProfile({ full_name: null, username: "ana-maria", country: null }), rule("U1"));
  assert.throws(() => validateProfile({ full_name: null, username: "a".repeat(31), country: null }), rule("U1"));
});

test("U2 y U3: nombre hasta 80 y país de dos letras", () => {
  assert.throws(() => validateProfile({ full_name: "x".repeat(81), username: null, country: null }), rule("U2"));
  assert.throws(() => validateProfile({ full_name: null, username: null, country: "CRI" }), rule("U3"));
});

test("U4: contraseña de 8+ con letras y números, distinta de la actual", () => {
  assert.doesNotThrow(() => assertValidPassword("finanzas2026", "vieja123"));
  assert.throws(() => assertValidPassword("corta1"), rule("U4"));
  assert.throws(() => assertValidPassword("solamenteletras"), rule("U4"));
  assert.throws(() => assertValidPassword("misma1234", "misma1234"), rule("U4"));
});

test("U5: correo nuevo válido y distinto del actual", () => {
  assert.equal(normalizeNewEmail(" Nuevo@Correo.com ", "viejo@correo.com"), "nuevo@correo.com");
  assert.throws(() => normalizeNewEmail("no-es-correo", null), rule("U5"));
  assert.throws(() => normalizeNewEmail("YO@correo.com", "yo@correo.com"), rule("U5"));
});

test("U6: foto JPG, PNG o WebP de hasta 2 MB", () => {
  assert.doesNotThrow(() => assertValidAvatar({ size: 120_000, type: "image/webp" }));
  assert.throws(() => assertValidAvatar({ size: 120_000, type: "image/gif" }), rule("U6"));
  assert.throws(() => assertValidAvatar({ size: 3 * 1024 * 1024, type: "image/png" }), rule("U6"));
});

test("iniciales: del nombre o, si no hay, del correo", () => {
  assert.equal(initialsOf("Oswald Andrés Reid", "x@y.com"), "OR");
  assert.equal(initialsOf(null, "osw2156@gmail.com"), "OS");
  assert.equal(initialsOf("", "ana.mora@correo.com"), "AM");
});

test("U8: borrar la cuenta pide ELIMINAR", () => {
  assert.doesNotThrow(() => assertDeleteConfirmation(" eliminar "));
  assert.throws(() => assertDeleteConfirmation("borrar"));
});

test("U9: preferencias con valores por defecto", () => {
  assert.deepEqual(readPreferences(null), { baseCurrency: "CRC", dateFormat: "corto" });
  assert.deepEqual(readPreferences({ baseCurrency: "USD", dateFormat: "largo" }), { baseCurrency: "USD", dateFormat: "largo" });
  assert.deepEqual(readPreferences({ baseCurrency: "EUR", dateFormat: "x" }), { baseCurrency: "CRC", dateFormat: "corto" });
});
