/** Repositorios en memoria para probar casos de uso sin base de datos. */

import { balanceEffects, type Currency } from "../domain/index.ts";
import type {
  AccountRepository,
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

  const accounts: AccountRepository = {
    currencyOf: async (id) => accountCurrencies.get(id) ?? null,
  };
  const cards: CardRepository = {
    currencyOf: async (id) => cardCurrencies.get(id) ?? null,
  };
  const movementRepo: MovementRepository = {
    cardIdOf: async (id) => movements.get(id)?.card_id ?? null,
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
    createWithInstallments: async (plan) => {
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

  /** Saldo de una cuenta/tarjeta según los movimientos guardados (G1). */
  const balanceOf = (target: "account" | "card", id: string) =>
    [...movements.values()]
      .flatMap((m) => balanceEffects(m))
      .filter((e) => e.target === target && e.id === id)
      .reduce((s, e) => s + e.delta, 0);

  return {
    deps: { accounts, cards, movements: movementRepo, financings: financingRepo, pending: pendingRepo, merchantRules },
    state: { movements, financings, pending, rules },
    balanceOf,
  };
}
