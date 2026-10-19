import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeStore } from "./fakes.test-helpers.ts";
import { refreshExchangeRate } from "./exchange-rates.ts";
import { InfrastructureError, type ExchangeRateSource } from "./ports.ts";

const source = (usd_crc: number, calls: { n: number }): ExchangeRateSource => ({
  async today() {
    calls.n++;
    return { rate_on: "2026-10-18", usd_crc };
  },
});

test("T10: trae el tipo de cambio una vez al día y lo guarda", async () => {
  const s = fakeStore();
  const calls = { n: 0 };
  const deps = { exchangeRates: s.deps.exchangeRates, exchangeRateSource: source(453.48, calls) };

  const first = await refreshExchangeRate(deps, { today: "2026-10-18" });
  assert.ok(first.ok && first.value.fetched);
  assert.deepEqual(s.state.rates, [{ rate_on: "2026-10-18", usd_crc: 453.48 }]);

  // Ya hay uno de hoy: no vuelve a consultar.
  const again = await refreshExchangeRate(deps, { today: "2026-10-18" });
  assert.ok(again.ok && !again.value.fetched);
  assert.equal(calls.n, 1);

  // A mano ("Traer del BCCR") sí consulta.
  assert.ok((await refreshExchangeRate(deps, { today: "2026-10-18", force: true })).ok);
  assert.equal(calls.n, 2);
});

test("T10: si la fuente no responde, el error es mostrable y no guarda nada", async () => {
  const s = fakeStore();
  const r = await refreshExchangeRate(
    {
      exchangeRates: s.deps.exchangeRates,
      exchangeRateSource: {
        async today() {
          throw new InfrastructureError("No se pudo consultar el tipo de cambio del BCCR");
        },
      },
    },
    { today: "2026-10-18" },
  );
  assert.equal(r.ok, false);
  assert.equal(s.state.rates.length, 0);
});
