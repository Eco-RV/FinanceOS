import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dismissSuggestion,
  enabledFeatures,
  firstSteps,
  initialFeatureState,
  isFeatureEnabled,
  isRouteVisible,
  nextSuggestion,
  readFeatureState,
  setFeatureChoice,
  showFirstSteps,
  type Usage,
} from "./features.ts";

const empty: Usage = { cards: 0, bankAccounts: 0, cardExpenses: 0, cardPayments: 0, expenses: 0, financings: 0 };

test("E3: una cuenta nueva arranca solo con el núcleo; una de antes, con todo", () => {
  const nueva = initialFeatureState(false);
  assert.equal(enabledFeatures(nueva).size, 0);
  assert.equal(showFirstSteps(nueva), true);

  const antes = initialFeatureState(true);
  assert.equal(isFeatureEnabled(antes, "planes"), true);
  assert.equal(isFeatureEnabled(antes, "herramientas"), true);
  assert.equal(showFirstSteps(antes), false);
});

test("E3: lo que el usuario elige manda, también sobre una cuenta de antes", () => {
  const antes = setFeatureChoice(initialFeatureState(true), "gmail", false);
  assert.equal(isFeatureEnabled(antes, "gmail"), false);
  assert.equal(isFeatureEnabled(antes, "planes"), true);

  const nueva = setFeatureChoice(initialFeatureState(false), "planes", true);
  assert.deepEqual([...enabledFeatures(nueva)], ["planes"]);
});

test("readFeatureState: null sin estado; ignora claves y valores que no conoce", () => {
  assert.equal(readFeatureState(undefined), null);
  assert.equal(readFeatureState("x"), null);
  const state = readFeatureState({
    choices: { planes: true, trading: true, ahorros: "si" },
    legacy: true,
    dismissed: ["analisis", "analisis", "otra"],
    stepsClosed: true,
  });
  assert.deepEqual(state, { choices: { planes: true }, legacy: true, dismissed: ["analisis"], stepsClosed: true });
});

test("E2: una ruta de una función apagada no se muestra; el núcleo siempre", () => {
  const on = enabledFeatures(setFeatureChoice(initialFeatureState(false), "planes", true));
  assert.equal(isRouteVisible(on, "/procesos/tarjetas"), true);
  assert.equal(isRouteVisible(on, "/procesos/gastos"), true);
  assert.equal(isRouteVisible(on, "/procesos/planes"), true);
  assert.equal(isRouteVisible(on, "/procesos/prestamos"), false);
  assert.equal(isRouteVisible(on, "/procesos/prestamos/abc"), false);
  assert.equal(isRouteVisible(on, "/ajustes/miembros"), false);
  assert.equal(isRouteVisible(on, "/ajustes/categorias"), true);
});

test("E4: el primer pago de tarjeta sugiere Planes; descartada, sigue la siguiente que aplique", () => {
  const state = initialFeatureState(false);
  assert.equal(nextSuggestion(state, empty), null);

  const usage = { ...empty, cards: 1, cardPayments: 1, expenses: 12 };
  assert.equal(nextSuggestion(state, usage)?.feature, "planes");
  assert.equal(nextSuggestion(dismissSuggestion(state, "planes"), usage)?.feature, "analisis");
  assert.equal(nextSuggestion(setFeatureChoice(state, "planes", true), usage)?.feature, "analisis");
});

test("E4: una cuenta de antes no recibe sugerencias (ya tiene todo)", () => {
  const usage = { ...empty, cardPayments: 3, expenses: 50, financings: 2, bankAccounts: 3 };
  assert.equal(nextSuggestion(initialFeatureState(true), usage), null);
});

test("E5: primeros pasos en orden, según los datos", () => {
  assert.deepEqual(
    firstSteps({ ...empty, cards: 1, cardExpenses: 2 }).map((s) => [s.key, s.done]),
    [
      ["tarjeta", true],
      ["cuenta", false],
      ["compra", true],
      ["pago", false],
    ],
  );
});
