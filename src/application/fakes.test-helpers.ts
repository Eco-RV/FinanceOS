/** Repositorios en memoria para probar casos de uso sin base de datos. */

import {
  balanceEffects,
  deriveBalances,
  type Currency,
  type CardCycle,
  type ExchangeRate,
  type MemberShare,
} from "../domain/index.ts";
import type {
  AccountRepository,
  BalanceRepository,
  BankFields,
  BankRepository,
  CardRepository,
  CategoryFields,
  CategoryRepository,
  DebitCardInput,
  DebitCardRepository,
  ExchangeRateRepository,
  FinancingRepository,
  FreshStartRepository,
  Loan,
  Mailer,
  Member,
  MemberRepository,
  NewNotice,
  NewReimbursement,
  NoticeRepository,
  OutgoingMail,
  ReimbursementRepository,
  LoanRepository,
  MerchantRuleRepository,
  MovementRepository,
  NewFinancing,
  NewMovement,
  PendingPurchase,
  PendingRepository,
  NewSharedNotice,
  SharedExpenseRepository,
  StoredLoanAdjustment,
  StoredSharedExpense,
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
  /** id → nombre. */
  members?: Record<string, string>;
  /** id → tipo de cuenta (default "checking"). */
  accountTypes?: Record<string, string>;
  /** id de tarjeta → ciclo (default corte 15, pago 30). */
  cardCycles?: Record<string, CardCycle>;
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
  const movements = new Map<
    string,
    NewMovement & { financing_id?: string | null; interest_amount?: number | null; archived?: boolean }
  >();
  const financings = new Map<string, NewFinancing>();
  const prepayments: {
    id: string;
    financing_id: string;
    previous: [string, NewMovement & { financing_id?: string | null; interest_amount?: number | null }][];
    months: number;
    transaction_id: string;
    amount: number;
    occurred_on: string;
    fromNo: number;
  }[] = [];
  const shares = new Map<string, MemberShare[]>();
  const memberRows = new Map<string, Omit<Member, "id">>(
    Object.entries(seed.members ?? {}).map(([id, name]) => [
      id,
      { name, email: `${id}@correo.cr`, phone: null, archived: false },
    ]),
  );
  const reimbursementRows = new Map<string, NewReimbursement>();
  const notices: NewNotice[] = [];
  const sentMail: OutgoingMail[] = [];
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
    typeOf: async (id) => {
      const r = accountRows.get(id);
      return r && !r.archived ? (seed.accountTypes?.[id] ?? "checking") : null;
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
  const debitCardRows = new Map<string, DebitCardInput & { archived: boolean }>();
  const debitCards: DebitCardRepository = {
    ...lifecycle(debitCardRows, (id) =>
      [...movements.values()].filter((m) => m.debit_card_id === id).length,
    ),
    save: async (id, fields) => {
      // C3: una activa por cuenta (como el índice único de la base).
      const clash = [...debitCardRows].some(
        ([key, c]) => key !== id && !c.archived && c.account_id === fields.account_id,
      );
      if (clash) throw new InfrastructureError("Esa cuenta ya tiene una tarjeta de débito activa");
      const key = id ?? nextId("deb");
      debitCardRows.set(key, { ...fields, archived: debitCardRows.get(key)?.archived ?? false });
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
    loanIdOf: async (id) => movements.get(id)?.loan_id ?? null,
    debitCardOf: async (id) => movements.get(id)?.debit_card_id ?? null,
    openingOf: async (target, id, currency) => {
      for (const [movementId, m] of movements) {
        const owner = target === "account" ? m.account_id : m.card_id;
        if (m.type === "opening_balance" && owner === id && m.currency === currency && !m.archived) {
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
          interest_amount: c.interest || null,
          currency: plan.currency ?? "CRC",
          occurred_on: c.occurred_on,
          category: plan.category,
          note: `${plan.description} (cuota ${c.no}/${c.of})`,
          account_id: null,
          card_id: plan.card_id,
          financing_id: id,
          installment_no: c.no,
        });
      }
      return { id };
    },
    find: async (id) => {
      const f = financings.get(id);
      return f
        ? {
            id,
            card_id: f.card_id,
            description: f.description,
            months: f.months,
            currency: f.currency ?? "CRC",
            cancelled_on: cancelled.get(id) ?? null,
            annual_rate: f.annual_rate,
            category: f.category,
          }
        : null;
    },
    pendingInstallments: async (id, todayISO) =>
      [...movements.values()]
        .filter((m) => m.financing_id === id && !m.archived && m.installment_no != null && m.occurred_on > todayISO)
        .map((m) => ({ no: m.installment_no!, occurred_on: m.occurred_on, amount: m.amount, interest: Number(m.interest_amount ?? 0) }))
        .sort((a, b) => a.no - b.no),
    prepay: async (id, input) => {
      const f = financings.get(id)!;
      const previous: [string, NewMovement & { financing_id?: string | null; interest_amount?: number | null }][] = [];
      for (const [mvId, m] of movements) {
        if (m.financing_id === id && m.installment_no! >= input.fromNo && m.occurred_on > input.todayISO) {
          previous.push([mvId, m]);
          movements.delete(mvId);
        }
      }
      for (const c of input.installments) {
        movements.set(nextId("mv"), {
          type: "expense",
          amount: c.amount,
          interest_amount: c.interest || null,
          currency: f.currency ?? "CRC",
          occurred_on: c.occurred_on,
          category: f.category,
          note: `${f.description} (cuota ${c.no}/${c.of})`,
          account_id: null,
          card_id: f.card_id,
          financing_id: id,
          installment_no: c.no,
        });
      }
      const prepId = nextId("prep");
      prepayments.push({ id: prepId, financing_id: id, previous, months: f.months, transaction_id: input.transaction_id, amount: input.amount, occurred_on: input.occurred_on, fromNo: input.fromNo });
      f.months = input.fromNo - 1 + input.installments.length;
      return { id: prepId };
    },
    lastPrepayment: async (id) => {
      const p = prepayments.filter((x) => x.financing_id === id).at(-1);
      return p ? { id: p.id, amount: p.amount, occurred_on: p.occurred_on } : null;
    },
    undoPrepayment: async (prepId) => {
      const i = prepayments.findIndex((x) => x.id === prepId);
      const p = prepayments[i];
      for (const [mvId, m] of movements) {
        if (m.financing_id === p.financing_id && m.installment_no! >= p.fromNo) movements.delete(mvId);
      }
      for (const [mvId, m] of p.previous) movements.set(mvId, m);
      financings.get(p.financing_id)!.months = p.months;
      movements.delete(p.transaction_id);
      prepayments.splice(i, 1);
    },
    cardIdOf: async (id) => financings.get(id)?.card_id ?? null,
    update: async (id, fields) => {
      const f = financings.get(id);
      if (!f) return;
      financings.set(id, { ...f, ...fields });
      for (const m of movements.values()) {
        if (m.financing_id !== id || m.archived) continue;
        m.category = fields.category;
        m.note = `${fields.description} (cuota ${m.installment_no}/${f.months})`;
      }
    },
    installments: async (id) =>
      [...movements.values()]
        .filter((m) => m.financing_id === id && !m.archived)
        .map((m) => ({ no: m.installment_no!, amount: m.amount, occurred_on: m.occurred_on }))
        .sort((a, b) => a.no - b.no),
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
    shares: async (id) => [...(shares.get(id) ?? [])],
    replaceShares: async (id, next) => {
      shares.set(id, [...next]);
    },
  };
  const membersRepo: MemberRepository = {
    find: async (id) => {
      const r = memberRows.get(id);
      return r ? { id, ...r } : null;
    },
    historyCount: async (id) =>
      [...shares.values()].flat().filter((s) => s.member_id === id).length +
      [...reimbursementRows.values()].filter((r) => r.member_id === id).length,
    setArchived: async (id, archived) => {
      const r = memberRows.get(id);
      if (r) r.archived = archived;
    },
    delete: async (id) => {
      memberRows.delete(id);
    },
    save: async (id, fields) => {
      const taken = [...memberRows.entries()].some(
        ([k, r]) => k !== id && !r.archived && r.name.toLowerCase() === fields.name.toLowerCase(),
      );
      if (taken) throw new InfrastructureError("Ya existe un miembro con ese nombre");
      const key = id ?? nextId("mem");
      memberRows.set(key, { ...fields, archived: memberRows.get(key)?.archived ?? false });
      return { id: key };
    },
  };
  const reimbursementsRepo: ReimbursementRepository = {
    create: async (r) => {
      const dup = [...reimbursementRows.values()].some(
        (x) =>
          x.financing_id === r.financing_id &&
          x.member_id === r.member_id &&
          x.installment_no === r.installment_no,
      );
      if (dup) throw new InfrastructureError("Esa parte ya está reembolsada");
      const id = nextId("reim");
      reimbursementRows.set(id, r);
      return { id };
    },
    membersWithReimbursements: async (financingId) => [
      ...new Set(
        [...reimbursementRows.values()]
          .filter((r) => r.financing_id === financingId)
          .map((r) => r.member_id),
      ),
    ],
    delete: async (id) => {
      const r = reimbursementRows.get(id);
      reimbursementRows.delete(id);
      return r?.financing_id ?? null;
    },
  };
  const noticesRepo: NoticeRepository = {
    record: async (items) => {
      notices.push(...items);
    },
  };
  // 3.0.1: gastos compartidos (X1–X6).
  const sharedRows = new Map<string, Omit<StoredSharedExpense, "id">>();
  const sharedNotices: NewSharedNotice[] = [];
  const sharedRepo: SharedExpenseRepository = {
    source: async (id) => {
      const m = movements.get(id);
      if (!m || m.archived) return null;
      return {
        movement_id: id,
        type: m.type,
        amount: m.amount,
        currency: m.currency,
        occurred_on: m.occurred_on,
        account_id: m.account_id,
        card: m.card_id
          ? { id: m.card_id, ...(seed.cardCycles?.[m.card_id] ?? { cutoff_day: 15, payment_due_day: 30 }) }
          : null,
        note: m.note,
        managed_elsewhere: Boolean(m.financing_id || m.loan_id),
      };
    },
    linkOf: async (movementId) => {
      for (const [id, s] of sharedRows) {
        if (s.transaction_id === movementId) return { shared_expense_id: id, role: "expense" };
        if (s.parts.some((p) => p.income_transaction_id === movementId)) {
          return { shared_expense_id: id, role: "income" };
        }
      }
      return null;
    },
    find: async (id) => {
      const s = sharedRows.get(id);
      return s ? { id, ...s, parts: s.parts.map((p) => ({ ...p })) } : null;
    },
    create: async (input) => {
      if ([...sharedRows.values()].some((s) => s.transaction_id === input.transaction_id)) {
        throw new InfrastructureError("Ese gasto ya está compartido");
      }
      const m = movements.get(input.transaction_id)!;
      const id = nextId("sh");
      sharedRows.set(id, {
        transaction_id: input.transaction_id,
        description: input.description,
        currency: input.currency,
        total_amount: input.total_amount,
        occurred_on: m.occurred_on,
        due_on: input.due_on,
        card_id: m.card_id,
        parts: input.shares.map((s) => ({ ...s, paid_on: null, channel: null, note: null, income_transaction_id: null })),
      });
      return { id };
    },
    update: async (id, fields) => {
      const s = sharedRows.get(id)!;
      const before = new Map(s.parts.map((p) => [p.member_id, p]));
      s.description = fields.description;
      s.due_on = fields.due_on;
      s.parts = fields.shares.map(
        (sh) =>
          before.get(sh.member_id)?.paid_on
            ? before.get(sh.member_id)!
            : { ...sh, paid_on: null, channel: null, note: null, income_transaction_id: null },
      );
    },
    setPayment: async (id, memberId, payment) => {
      const p = sharedRows.get(id)!.parts.find((x) => x.member_id === memberId)!;
      p.paid_on = payment?.paid_on ?? null;
      p.channel = payment?.channel ?? null;
      p.note = payment?.note ?? null;
      p.income_transaction_id = payment?.income_transaction_id ?? null;
    },
    delete: async (id) => {
      sharedRows.delete(id);
    },
    recordNotices: async (items) => {
      sharedNotices.push(...items);
    },
  };
  const mailer: Mailer = {
    send: async (mail) => {
      sentMail.push(mail);
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
    update: async (key, category) => {
      rules.set(key, category);
    },
    delete: async (key) => {
      rules.delete(key);
    },
  };

  const loanRows = new Map<string, Omit<Loan, "id">>();
  const loanAdjustments: (StoredLoanAdjustment & { loan_id: string })[] = [];
  const loanPayments = (loanId: string) =>
    [...movements].filter(([, m]) => m.loan_id === loanId && m.installment_no != null);
  const loans: LoanRepository = {
    ...lifecycle(loanRows, (id) => loanPayments(id).length),
    find: async (id) => {
      const r = loanRows.get(id);
      return r ? { ...r, id } : null;
    },
    create: async (fields) => {
      const id = nextId("loan");
      loanRows.set(id, { ...fields, archived: false });
      return { id };
    },
    rename: async (id, fields) => {
      const r = loanRows.get(id);
      if (r) Object.assign(r, fields);
    },
    paidInstallments: async (id) => loanPayments(id).map(([, m]) => m.installment_no!),
    paymentOf: async (id, no) => loanPayments(id).find(([, m]) => m.installment_no === no)?.[0] ?? null,
    adjustments: async (id) =>
      loanAdjustments
        .filter((a) => a.loan_id === id && (!a.transaction_id || movements.has(a.transaction_id)))
        .map((a) => ({ id: a.id, event: a.event, occurred_on: a.occurred_on, transaction_id: a.transaction_id })),
    addAdjustment: async (id, input) => {
      const adjId = nextId("adj");
      loanAdjustments.push({ id: adjId, loan_id: id, ...input });
      return { id: adjId };
    },
    deleteAdjustment: async (adjId) => {
      const i = loanAdjustments.findIndex((a) => a.id === adjId);
      if (i >= 0) loanAdjustments.splice(i, 1);
    },
    delete: async (id) => {
      loanRows.delete(id);
      // on delete cascade: arrastra el desembolso.
      for (const [mvId, m] of movements) if (m.loan_id === id) movements.delete(mvId);
    },
  };

  const freshStarts: { on: string; archived: number }[] = [];
  const freshStart: FreshStartRepository = {
    activeProducts: async () => [
      ...[...accountRows]
        .filter(([, r]) => !r.archived)
        .map(([id, r]) => ({ kind: "account" as const, id, name: r.name, currencies: [r.currency] })),
      ...[...cardRows]
        .filter(([, r]) => !r.archived)
        .map(([id, r]) => ({
          kind: "card" as const,
          id,
          name: r.name,
          currencies: ["CRC", "USD"] as Currency[],
        })),
    ],
    // Igual que supabase/Versionamiento/2.2.0/00_fresh_start.sql.
    run: async (todayISO, on, openings) => {
      for (const [id, m] of movements) {
        if (m.financing_id && m.occurred_on > todayISO && !m.archived) movements.delete(id);
      }
      let archived = 0;
      for (const m of movements.values()) {
        if (!m.archived) archived++;
        m.archived = true;
        m.financing_id = null;
        m.loan_id = null;
      }
      financings.clear();
      // Cascada de los financiamientos (2.3.0): partes, reembolsos y avisos.
      shares.clear();
      reimbursementRows.clear();
      notices.length = 0;
      loanRows.clear();
      for (const o of openings) {
        movements.set(nextId("mv"), {
          type: "opening_balance",
          amount: o.amount,
          currency: o.currency,
          occurred_on: on,
          category: null,
          note: "Saldo inicial (arranque de 0)",
          account_id: o.kind === "account" ? o.id : null,
          card_id: o.kind === "card" ? o.id : null,
        });
      }
      freshStarts.push({ on, archived });
      return archived;
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
      debitCards,
      categories,
      banks,
      loans,
      freshStart,
      movements: movementRepo,
      financings: financingRepo,
      members: membersRepo,
      reimbursements: reimbursementsRepo,
      notices: noticesRepo,
      mailer,
      pending: pendingRepo,
      merchantRules,
      balances,
      exchangeRates,
      sharedExpenses: sharedRepo,
    },
    state: {
      sharedRows,
      sharedNotices,
      movements,
      financings,
      shares,
      memberRows,
      reimbursementRows,
      notices,
      sentMail,
      cancelled,
      rates,
      pending,
      rules,
      stored,
      accountRows,
      cardRows,
      debitCardRows,
      categoryRows,
      bankRows,
      loanRows,
      freshStarts,
    },
    balanceOf,
  };
}
