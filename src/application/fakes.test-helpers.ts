/** Repositorios en memoria para probar casos de uso sin base de datos. */

import { balanceEffects, deriveBalances, type Currency } from "../domain/index.ts";
import type {
  AccountRepository,
  BalanceRepository,
  CardRepository,
  FinancingRepository,
  MerchantRuleRepository,
  MovementRepository,
  NewFinancing,
  NewMovement,
  PendingPurchase,
  PendingRepository,
} from "./ports.ts";

export function fakeStore(seed: {
  accounts?: Record<string, Currency>;
  cards?: Record<string, Currency>;
  pending?: PendingPurchase[];
} = {}) {
  const accountCurrencies = new Map(Object.entries(seed.accounts ?? {}));
  const cardCurrencies = new Map(Object.entries(seed.cards ?? {}));
  const movements = new Map<string, NewMovement>();
  const financings = new Map<string, NewFinancing>();
  const pending = new Map((seed.pending ?? []).map((p) => [p.id, { ...p, status: "pending" }]));
  const rules = new Map<string, string>();
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  /** Saldos guardados (proyección), que se pueden desincronizar a propósito. */
  const stored = new Map<string, number>();

  const accounts: AccountRepository = {
    currencyOf: async (id) => accountCurrencies.get(id) ?? null,
    save: async (id, fields) => {
      const key = id ?? nextId("acc");
      accountCurrencies.set(key, fields.currency);
      return { id: key };
    },
    delete: async (id) => {
      accountCurrencies.delete(id);
    },
  };
  const cards: CardRepository = {
    currencyOf: async (id) => cardCurrencies.get(id) ?? null,
    save: async (id, fields) => {
      const key = id ?? nextId("card");
      cardCurrencies.set(key, fields.currency);
      return { id: key };
    },
    delete: async (id) => {
      cardCurrencies.delete(id);
    },
  };
  const movementRepo: MovementRepository = {
    cardIdOf: async (id) => movements.get(id)?.card_id ?? null,
    openingOf: async (target, id) => {
      for (const [movementId, m] of movements) {
        const owner = target === "account" ? m.account_id : m.card_id;
        if (m.type === "opening_balance" && owner === id) {
          return { id: movementId, amount: m.amount, occurred_on: m.occurred_on };
        }
      }
      return null;
    },
    create: async (m) => {
      const id = nextId("mv");
      movements.set(id, m);
      return { id };
    },
    update: async (id, m) => {
      movements.set(id, m);
    },
    delete: async (id) => {
      movements.delete(id);
    },
  };
  const financingRepo: FinancingRepository = {
    createWithInstallments: async (plan, installments) => {
      if (installments.length !== plan.months) throw new Error("cuotas incompletas");
      const id = nextId("fin");
      financings.set(id, plan);
      return { id };
    },
    cardIdOf: async (id) => financings.get(id)?.card_id ?? null,
    delete: async (id) => {
      financings.delete(id);
    },
  };
  const pendingRepo: PendingRepository = {
    findOpen: async (id) => {
      const p = pending.get(id);
      return p && p.status === "pending" ? p : null;
    },
    markApproved: async (id) => {
      const p = pending.get(id);
      if (p) p.status = "approved";
    },
    markRejected: async (id) => {
      const p = pending.get(id);
      if (p) p.status = "rejected";
    },
  };
  const merchantRules: MerchantRuleRepository = {
    learn: async (key, category) => {
      rules.set(key, category);
    },
  };

  const balances: BalanceRepository = {
    stored: async () => [
      ...[...accountCurrencies.keys()].map((id) => ({
        target: "account" as const,
        id,
        stored: stored.get(id) ?? 0,
      })),
      ...[...cardCurrencies.keys()].map((id) => ({
        target: "card" as const,
        id,
        stored: stored.get(id) ?? 0,
      })),
    ],
    movements: async () => [...movements.values()],
    recompute: async () => {
      const derived = deriveBalances([...movements.values()]);
      let changed = 0;
      for (const map of [derived.accounts, derived.cards]) {
        for (const [id, value] of map) {
          if (stored.get(id) !== value) changed++;
          stored.set(id, value);
        }
      }
      return changed;
    },
  };

  /** Saldo de una cuenta/tarjeta según los movimientos guardados (G1). */
  const balanceOf = (target: "account" | "card", id: string) =>
    [...movements.values()]
      .flatMap((m) => balanceEffects(m))
      .filter((e) => e.target === target && e.id === id)
      .reduce((s, e) => s + e.delta, 0);

  return {
    deps: {
      accounts,
      cards,
      movements: movementRepo,
      financings: financingRepo,
      pending: pendingRepo,
      merchantRules,
      balances,
    },
    state: { movements, financings, pending, rules, stored, accountCurrencies, cardCurrencies },
    balanceOf,
  };
}
