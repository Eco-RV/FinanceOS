/** Repositorios en memoria para probar casos de uso sin base de datos. */

import {
  balanceEffects,
  deriveBalances,
  type Currency,
  type ExchangeRate,
} from "../domain/index.ts";
import type {
  AccountRepository,
  BalanceRepository,
  CardRepository,
  ExchangeRateRepository,
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
  const movements = new Map<string, NewMovement & { financing_id?: string }>();
  const financings = new Map<string, NewFinancing>();
  const cancelled = new Map<string, string>();
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
    openingOf: async (target, id, currency) => {
      for (const [movementId, m] of movements) {
        const owner = target === "account" ? m.account_id : m.card_id;
        if (m.type === "opening_balance" && owner === id && m.currency === currency) {
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
      for (const c of installments) {
        movements.set(nextId("mv"), {
          type: "expense",
          amount: c.amount,
          currency: "CRC",
          occurred_on: c.occurred_on,
          category: plan.category,
          note: `${plan.description} (cuota ${c.no}/${c.of})`,
          account_id: null,
          card_id: plan.card_id,
          financing_id: id,
        });
      }
      return { id };
    },
    cardIdOf: async (id) => financings.get(id)?.card_id ?? null,
    cancel: async (id, todayISO) => {
      for (const [mvId, m] of movements) {
        if (m.financing_id === id && m.occurred_on > todayISO) movements.delete(mvId);
      }
      const kept = [...movements.values()].some((m) => m.financing_id === id);
      if (!kept) {
        financings.delete(id);
        return "deleted";
      }
      cancelled.set(id, todayISO);
      return "cancelled";
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

  const cardKey = (id: string, currency: Currency) => `${id}:${currency}`;
  const balances: BalanceRepository = {
    stored: async () => [
      ...[...accountCurrencies.keys()].map((id) => ({
        target: "account" as const,
        id,
        stored: stored.get(id) ?? 0,
      })),
      ...[...cardCurrencies.keys()].flatMap((id) =>
        (["CRC", "USD"] as const).map((currency) => ({
          target: "card" as const,
          id,
          currency,
          stored: stored.get(cardKey(id, currency)) ?? 0,
        })),
      ),
    ],
    movements: async () => [...movements.values()],
    recompute: async () => {
      const derived = deriveBalances([...movements.values()]);
      let changed = 0;
      const set = (key: string, value: number) => {
        if ((stored.get(key) ?? 0) !== value) changed++;
        stored.set(key, value);
      };
      for (const [id, value] of derived.accounts) set(id, value);
      for (const [id, byCurrency] of derived.cards) {
        for (const [cur, value] of Object.entries(byCurrency)) set(cardKey(id, cur as Currency), value!);
      }
      return changed;
    },
  };

  const rates: ExchangeRate[] = [];
  const exchangeRates: ExchangeRateRepository = {
    latest: async () =>
      [...rates].sort((a, b) => (a.rate_on < b.rate_on ? 1 : -1))[0] ?? null,
    save: async (rate) => {
      const i = rates.findIndex((r) => r.rate_on === rate.rate_on);
      if (i >= 0) rates[i] = rate;
      else rates.push(rate);
    },
  };

  /** Saldo de una cuenta/tarjeta según los movimientos guardados (G1). */
  const balanceOf = (target: "account" | "card", id: string, currency?: Currency) =>
    [...movements.values()]
      .flatMap((m) => balanceEffects(m))
      .filter((e) => e.target === target && e.id === id && (!currency || e.currency === currency))
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
      exchangeRates,
    },
    state: { movements, financings, cancelled, rates, pending, rules, stored, accountCurrencies, cardCurrencies },
    balanceOf,
  };
}
