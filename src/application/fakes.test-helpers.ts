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
  BankFields,
  BankRepository,
  CardRepository,
  CategoryFields,
  CategoryRepository,
  ExchangeRateRepository,
  FinancingRepository,
  MerchantRuleRepository,
  MovementRepository,
  NewFinancing,
  NewMovement,
  PendingPurchase,
  PendingRepository,
} from "./ports.ts";
import { InfrastructureError } from "./ports.ts";

type Product = { name: string; currency: Currency; archived: boolean; bank_id: string | null };
type CategoryRow = CategoryFields & { archived: boolean };
type BankRow = BankFields & { archived: boolean };
type PendingRow = PendingPurchase & { status: string; bank_id?: string | null };

export function fakeStore(seed: {
  accounts?: Record<string, Currency>;
  cards?: Record<string, Currency>;
  pending?: (PendingPurchase & { bank_id?: string | null })[];
  categories?: Record<string, CategoryRow>;
  banks?: Record<string, BankRow>;
} = {}) {
  const product = (currency: Currency, name: string): Product => ({
    name,
    currency,
    archived: false,
    bank_id: null,
  });
  const accountRows = new Map(
    Object.entries(seed.accounts ?? {}).map(([id, c]) => [id, product(c, id)]),
  );
  const cardRows = new Map(
    Object.entries(seed.cards ?? {}).map(([id, c]) => [id, product(c, id)]),
  );
  const categoryRows = new Map(Object.entries(seed.categories ?? {}));
  const bankRows = new Map(Object.entries(seed.banks ?? {}));
  const movements = new Map<string, NewMovement & { financing_id?: string }>();
  const financings = new Map<string, NewFinancing>();
  const cancelled = new Map<string, string>();
  const pending = new Map<string, PendingRow>(
    (seed.pending ?? []).map((p) => [p.id, { ...p, status: "pending" }]),
  );
  const rules = new Map<string, string>();
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  /** Saldos guardados (proyección), que se pueden desincronizar a propósito. */
  const stored = new Map<string, number>();

  /** Lo que comparten los fakes de catálogo: buscar, desactivar, borrar. */
  function lifecycle<Row extends { name: string; archived: boolean }>(
    rows: Map<string, Row>,
    historyCount: (id: string) => number,
  ) {
    return {
      find: async (id: string) => {
        const r = rows.get(id);
        return r ? { ...r } : null;
      },
      historyCount: async (id: string) => historyCount(id),
      setArchived: async (id: string, archived: boolean) => {
        const r = rows.get(id);
        if (r) r.archived = archived;
      },
      delete: async (id: string) => {
        rows.delete(id);
      },
    };
  }

  const isOwnHistory = (m: NewMovement, key: "account_id" | "card_id", id: string) =>
    m.type !== "opening_balance" && (m[key] === id || (key === "account_id" && m.to_account_id === id));

  const accounts: AccountRepository = {
    ...lifecycle(accountRows, (id) =>
      [...movements.values()].filter((m) => isOwnHistory(m, "account_id", id)).length,
    ),
    currencyOf: async (id) => {
      const r = accountRows.get(id);
      return r && !r.archived ? r.currency : null;
    },
    save: async (id, fields) => {
      const key = id ?? nextId("acc");
      const prev = accountRows.get(key);
      accountRows.set(key, {
        name: fields.name,
        currency: fields.currency,
        archived: prev?.archived ?? false,
        bank_id: null,
      });
      return { id: key };
    },
  };
  const cards: CardRepository = {
    ...lifecycle(cardRows, (id) =>
      [...movements.values()].filter((m) => isOwnHistory(m, "card_id", id)).length +
      [...financings.values()].filter((f) => f.card_id === id).length,
    ),
    currencyOf: async (id) => {
      const r = cardRows.get(id);
      return r && !r.archived ? r.currency : null;
    },
    save: async (id, fields) => {
      const key = id ?? nextId("card");
      const prev = cardRows.get(key);
      cardRows.set(key, {
        name: fields.name,
        currency: fields.currency,
        archived: prev?.archived ?? false,
        bank_id: fields.bank_id === undefined ? (prev?.bank_id ?? null) : fields.bank_id,
      });
      return { id: key };
    },
  };
  const lower = (n: string) => n.trim().toLowerCase();
  const categories: CategoryRepository = {
    ...lifecycle(categoryRows, (id) => {
      const c = categoryRows.get(id);
      if (!c) return 0;
      return [...movements.values()].filter(
        (m) => m.type === c.kind && m.category != null && lower(m.category) === lower(c.name),
      ).length;
    }),
    save: async (id, fields) => {
      const clash = [...categoryRows].some(
        ([key, c]) =>
          key !== id && !c.archived && c.kind === fields.kind && lower(c.name) === lower(fields.name),
      );
      if (clash) throw new InfrastructureError("Ya existe esa categoría");
      const key = id ?? nextId("cat");
      categoryRows.set(key, { ...fields, archived: categoryRows.get(key)?.archived ?? false });
      return { id: key };
    },
    names: async (kind) => [...categoryRows.values()].filter((c) => c.kind === kind).map((c) => c.name),
    createMany: async (rows) => {
      for (const r of rows) categoryRows.set(nextId("cat"), { ...r, archived: false });
    },
    isDeactivated: async (kind, name) => {
      const same = [...categoryRows.values()].filter(
        (c) => c.kind === kind && lower(c.name) === lower(name),
      );
      return same.length > 0 && same.every((c) => c.archived);
    },
  };
  const banks: BankRepository = {
    ...lifecycle(bankRows, (id) => [...pending.values()].filter((p) => p.bank_id === id).length),
    save: async (id, fields) => {
      const key = id ?? nextId("bank");
      bankRows.set(key, { ...fields, archived: bankRows.get(key)?.archived ?? false });
      return { id: key };
    },
  };
  const movementRepo: MovementRepository = {
    cardIdOf: async (id) => movements.get(id)?.card_id ?? null,
    categoryOf: async (id) => movements.get(id)?.category ?? null,
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
      ...[...accountRows.keys()].map((id) => ({
        target: "account" as const,
        id,
        stored: stored.get(id) ?? 0,
      })),
      ...[...cardRows.keys()].flatMap((id) =>
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
      categories,
      banks,
      movements: movementRepo,
      financings: financingRepo,
      pending: pendingRepo,
      merchantRules,
      balances,
      exchangeRates,
    },
    state: {
      movements,
      financings,
      cancelled,
      rates,
      pending,
      rules,
      stored,
      accountRows,
      cardRows,
      categoryRows,
      bankRows,
    },
    balanceOf,
  };
}
