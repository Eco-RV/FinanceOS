import assert from "node:assert/strict";
import { test } from "node:test";
import type { Currency } from "../domain/index.ts";
import type {
  AccountRepository,
  CardRepository,
  CategoryRepository,
  DebitCardRepository,
  Goal,
  GoalFields,
  GoalRepository,
  NewMovement,
  Plan,
  PlanFields,
  PlanRepository,
} from "./ports.ts";
import {
  deletePlan,
  deleteGoal,
  saveGoal,
  allocateToGoal,
  savePlan,
  setPlanActive,
  syncPlans,
  confirmPlanOccurrence,
} from "./plans.ts";

function fakePlans() {
  const plans = new Map<string, Plan>();
  const movements: NewMovement[] = [];
  let n = 0;
  const repo: PlanRepository = {
    async list() {
      return [...plans.values()];
    },
    async find(id) {
      return plans.get(id) ?? null;
    },
    async save(id, fields, generatedThrough) {
      const planId = id ?? `p${++n}`;
      const prev = plans.get(planId);
      plans.set(planId, {
        ...fields,
        id: planId,
        archived: prev?.archived ?? false,
        generated_through: id ? (prev?.generated_through ?? null) : (generatedThrough ?? null),
      });
      return { id: planId };
    },
    async setArchived(id, archived, generatedThrough) {
      const p = plans.get(id)!;
      plans.set(id, {
        ...p,
        archived,
        generated_through: generatedThrough === undefined ? p.generated_through : generatedThrough,
      });
    },
    async delete(id) {
      plans.delete(id);
    },
    async materialize(id, through, rows) {
      let added = 0;
      for (const r of rows) {
        if (movements.some((m) => m.plan_id === id && m.occurred_on === r.occurred_on)) continue;
        movements.push(r);
        added++;
      }
      const p = plans.get(id)!;
      plans.set(id, { ...p, generated_through: p.generated_through && p.generated_through > through ? p.generated_through : through });
      return added;
    },
    async estimatedOccurrences() {
      return movements
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.estimated)
        .map(({ m, i }) => ({
          movement_id: `m${i}`,
          plan_id: m.plan_id!,
          plan_name: plans.get(m.plan_id!)?.name ?? "",
          kind: plans.get(m.plan_id!)?.kind ?? "salary",
          occurred_on: m.occurred_on,
          amount: m.amount,
          currency: m.currency,
        }));
    },
    async confirmOccurrence(movementId, amount) {
      const m = movements[Number(movementId.slice(1))];
      m.amount = amount;
      m.estimated = false;
    },
  };
  return { repo, plans, movements };
}

const accounts = (map: Record<string, Currency>): AccountRepository =>
  ({
    async currencyOf(id: string) {
      return map[id] ?? null;
    },
  }) as unknown as AccountRepository;

const cards = (ids: string[]): CardRepository =>
  ({
    async currencyOf(id: string) {
      return ids.includes(id) ? "CRC" : null;
    },
  }) as unknown as CardRepository;

const categories = (deactivated: string[] = []): CategoryRepository =>
  ({
    async isDeactivated(_kind: string, name: string) {
      return deactivated.includes(name);
    },
  }) as unknown as CategoryRepository;

const salary: PlanFields = {
  kind: "salary",
  name: "Salario",
  amount: 250_000,
  currency: "CRC",
  frequency: "semimonthly",
  starts_on: "2026-01-01",
  ends_on: null,
  account_id: "bac",
  card_id: null,
  category: null,
  note: null,
};

function deps() {
  const p = fakePlans();
  return {
    p,
    deps: { plans: p.repo, accounts: accounts({ bac: "CRC", usd: "USD" }), cards: cards(["visa"]), categories: categories() },
  };
}

test("P6: un plan con inicio pasado registra desde hoy, no hacia atrás", async () => {
  const { p, deps: d } = deps();
  const r = await savePlan(d, { id: null, fields: salary, today: "2026-10-14" });
  assert.ok(r.ok);
  assert.equal(p.plans.get("p1")?.generated_through, "2026-10-13");
  assert.equal(p.plans.get("p1")?.category, "Salario");

  await syncPlans(p.repo, "2026-10-14");
  assert.equal(p.movements.length, 0);
  const s = await syncPlans(p.repo, "2026-11-01");
  assert.ok(s.ok && s.value.registered === 2);
  assert.deepEqual(p.movements.map((m) => [m.type, m.occurred_on, m.account_id]), [
    ["income", "2026-10-15", "bac"],
    ["income", "2026-10-31", "bac"],
  ]);
  // Idempotente.
  await syncPlans(p.repo, "2026-11-01");
  assert.equal(p.movements.length, 2);
});

test("G3/G4: la cuenta del salario existe y es de la moneda del plan", async () => {
  const { deps: d } = deps();
  const usd = await savePlan(d, { id: null, fields: { ...salary, account_id: "usd" }, today: "2026-10-14" });
  assert.equal(usd.ok, false);
  const gone = await savePlan(d, { id: null, fields: { ...salary, account_id: "x" }, today: "2026-10-14" });
  assert.equal(!gone.ok && gone.rule, "G4");
});

test("T9: el seguro va a una tarjeta y genera gastos mensuales", async () => {
  const { p, deps: d } = deps();
  const r = await savePlan(d, {
    id: null,
    fields: { ...salary, kind: "insurance", name: "Seguro de vida", amount: 3_500, frequency: "monthly", starts_on: "2026-10-20", account_id: null, card_id: "visa" },
    today: "2026-10-14",
  });
  assert.ok(r.ok);
  assert.equal(p.plans.get("p1")?.generated_through, null);
  await syncPlans(p.repo, "2026-11-25");
  assert.deepEqual(p.movements.map((m) => [m.type, m.occurred_on, m.card_id, m.category]), [
    ["expense", "2026-10-20", "visa", "Seguros"],
    ["expense", "2026-11-20", "visa", "Seguros"],
  ]);
});

test("pausar no registra; reanudar sigue desde hoy sin lo pausado", async () => {
  const { p, deps: d } = deps();
  await savePlan(d, { id: null, fields: salary, today: "2026-10-14" });
  await setPlanActive(p.repo, { id: "p1", active: false, today: "2026-10-14" });
  await syncPlans(p.repo, "2026-12-01");
  assert.equal(p.movements.length, 0);
  await setPlanActive(p.repo, { id: "p1", active: true, today: "2026-12-01" });
  await syncPlans(p.repo, "2026-12-16");
  assert.deepEqual(p.movements.map((m) => m.occurred_on), ["2026-12-15"]);
});

test("P3: eliminar el plan conserva lo registrado", async () => {
  const { p, deps: d } = deps();
  await savePlan(d, { id: null, fields: salary, today: "2026-10-14" });
  await syncPlans(p.repo, "2026-10-20");
  assert.ok((await deletePlan(p.repo, "p1")).ok);
  assert.equal(p.plans.size, 0);
  assert.equal(p.movements.length, 1);
});

test("no se cambia el tipo de un plan al editarlo", async () => {
  const { deps: d } = deps();
  await savePlan(d, { id: null, fields: salary, today: "2026-10-14" });
  const r = await savePlan(d, {
    id: "p1",
    fields: { ...salary, kind: "subscription", frequency: "monthly", account_id: null, card_id: "visa" },
    today: "2026-10-14",
  });
  assert.equal(r.ok, false);
});

function fakeGoals() {
  const goals = new Map<string, Goal>();
  let n = 0;
  const repo: GoalRepository = {
    async find(id) {
      return goals.get(id) ?? null;
    },
    async onAccount(accountId) {
      return [...goals.values()]
        .filter((g) => g.account_id === accountId && !g.archived)
        .map((g) => ({ id: g.id, allocated: g.allocated ?? 0 }));
    },
    async accountBalance() {
      return 300_000;
    },
    async setAllocated(id, allocated) {
      goals.set(id, { ...goals.get(id)!, allocated });
    },
    async save(id, fields: GoalFields) {
      const goalId = id ?? `g${++n}`;
      goals.set(goalId, { ...fields, id: goalId, archived: goals.get(goalId)?.archived ?? false });
      return { id: goalId };
    },
    async setArchived(id, archived) {
      goals.set(id, { ...goals.get(id)!, archived });
    },
    async delete(id) {
      goals.delete(id);
    },
  };
  return { repo, goals };
}

test("A1/A2: meta con cuenta de su moneda y fecha futura", async () => {
  const g = fakeGoals();
  const d = { goals: g.repo, accounts: accounts({ ahorro: "CRC" }) };
  const fields: GoalFields = {
    name: " Viaje ",
    target_amount: 800_000,
    currency: "CRC",
    target_date: "2027-06-01",
    account_id: "ahorro",
    icon: "plane",
  };
  const r = await saveGoal(d, { id: null, fields, today: "2026-10-14" });
  assert.ok(r.ok);
  assert.equal(g.goals.get("g1")?.name, "Viaje");

  const usd = await saveGoal(d, { id: null, fields: { ...fields, currency: "USD" }, today: "2026-10-14" });
  assert.equal(!usd.ok && usd.rule, "A1");
  const past = await saveGoal(d, { id: null, fields: { ...fields, target_date: "2026-01-01" }, today: "2026-10-14" });
  assert.equal(!past.ok && past.rule, "A2");

  assert.ok((await deleteGoal(g.repo, "g1")).ok);
  assert.equal(g.goals.size, 0);
});

test("P2 (2.8.0): gasto fijo con tarjeta de débito, cobrado a su cuenta", async () => {
  const p = fakePlans();
  const debitCards = {
    async find(id: string) {
      return id === "deb" ? { account_id: "bac", name: "Débito", archived: false } : null;
    },
  } as unknown as DebitCardRepository;
  const d = { plans: p.repo, accounts: accounts({ bac: "CRC", bn: "CRC" }), cards: cards([]), categories: categories(), debitCards };
  const netflix: PlanFields = {
    ...salary,
    kind: "subscription",
    name: "Netflix",
    amount: 7_000,
    frequency: "monthly",
    starts_on: "2026-10-01",
    debit_card_id: "deb",
  };
  const r = await savePlan(d, { id: null, fields: netflix, today: "2026-10-01" });
  assert.ok(r.ok);
  assert.equal(p.plans.get(r.value.id)?.debit_card_id, "deb");

  const synced = await syncPlans(p.repo, "2026-10-01");
  assert.ok(synced.ok);
  assert.equal(p.movements[0].debit_card_id, "deb");
  assert.equal(p.movements[0].account_id, "bac");

  const wrong = await savePlan(d, { id: null, fields: { ...netflix, account_id: "bn" }, today: "2026-10-01" });
  assert.equal(!wrong.ok && wrong.rule, "C3");

  // T9 (3.0.1): un seguro sobre la tarjeta de débito (el banco la asegura).
  const seguro = await savePlan(d, {
    id: null,
    fields: { ...netflix, kind: "insurance", name: "Seguro de la tarjeta", amount: 1_200, category: null },
    today: "2026-10-01",
  });
  assert.ok(seguro.ok);
  const stored = p.plans.get(seguro.value.id);
  assert.equal(stored?.debit_card_id, "deb");
  assert.equal(stored?.account_id, "bac");
  assert.equal(stored?.category, "Seguros");
});

test("P7: un salario variable entra con el estimado y se confirma el real", async () => {
  const { p, deps: d } = deps();
  const r = await savePlan(d, { id: null, fields: { ...salary, variable: true }, today: "2026-10-14" });
  assert.ok(r.ok);
  await syncPlans(p.repo, "2026-10-16");
  assert.equal(p.movements.length, 1);
  assert.equal(p.movements[0].estimated, true);
  const [pending] = await p.repo.estimatedOccurrences();
  assert.equal((await confirmPlanOccurrence(p.repo, { movement_id: pending.movement_id, amount: 0 })).ok, false);
  assert.ok((await confirmPlanOccurrence(p.repo, { movement_id: pending.movement_id, amount: 812_345 })).ok);
  assert.equal(p.movements[0].amount, 812_345);
  assert.equal((await p.repo.estimatedOccurrences()).length, 0);
});

test("A4: dos metas en la misma cuenta, con apartados que no pasan el saldo", async () => {
  const g = fakeGoals();
  const d = { goals: g.repo, accounts: accounts({ ahorro: "CRC" }) };
  const base = { name: "Viaje", target_amount: 500_000, currency: "CRC" as const, target_date: null, account_id: "ahorro", icon: null };
  const a = await saveGoal(d, { id: null, fields: base, today: "2026-10-19" });
  const b = await saveGoal(d, { id: null, fields: { ...base, name: "Carro" }, today: "2026-10-19" });
  assert.ok(a.ok && b.ok);
  assert.ok((await allocateToGoal(g.repo, { goal_id: a.value.id, allocated: 200_000 })).ok);
  const over = await allocateToGoal(g.repo, { goal_id: b.value.id, allocated: 150_000 });
  assert.equal(!over.ok && over.rule, "A4");
  assert.ok((await allocateToGoal(g.repo, { goal_id: b.value.id, allocated: 100_000 })).ok);
});
