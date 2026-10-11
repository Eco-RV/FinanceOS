/**
 * Libro de movimientos: la **fuente de verdad** (G1). Todo saldo de cuenta o
 * tarjeta se deriva de aquí. El trigger `transactions_balance_sync` de Postgres
 * mantiene una copia (`current_balance`) con exactamente estas mismas reglas de
 * signo; `deriveBalances` permite verificarla.
 */

import { DomainError } from "../shared/errors.ts";
import { assertSameCurrency, fromCents, toCents, type Currency } from "../shared/money.ts";

export const MOVEMENT_TYPES = [
  "expense",
  "income",
  "card_payment",
  "opening_balance",
  "transfer",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type Movement = {
  type: MovementType;
  amount: number;
  account_id: string | null;
  card_id: string | null;
  /** Cuenta destino, solo en transferencias. */
  to_account_id?: string | null;
  /**
   * Moneda del movimiento. En una tarjeta decide a qué saldo va (T1: tarjeta
   * bimoneda). Si falta se asume CRC.
   */
  currency?: Currency;
  archived?: boolean;
};

/** Canal de un gasto desde cuenta. Hoy solo SINPE Móvil. */
export const MOVEMENT_CHANNELS = ["sinpe"] as const;
export type MovementChannel = (typeof MOVEMENT_CHANNELS)[number];

export type BalanceTarget = "account" | "card";

export type BalanceEffect = {
  target: BalanceTarget;
  id: string;
  /** Cambio en el saldo guardado (cuenta: disponible; tarjeta: deuda). */
  delta: number;
  /** Moneda del saldo afectado (en tarjetas, cada moneda es un saldo aparte). */
  currency: Currency;
};

/**
 * Efecto de un movimiento sobre los saldos. Convención de signo:
 * - gasto en cuenta: cuenta **−**
 * - gasto con tarjeta: deuda **+**
 * - ingreso: cuenta **+**
 * - abono (`card_payment`): cuenta **−** y deuda **−**
 * - transferencia (`transfer`, M2): origen **−**, destino **+** (no es gasto)
 * - saldo inicial (`opening_balance`, C1): cuenta **+monto** / deuda **+monto**;
 *   es el único tipo con monto **con signo** (sobregiro inicial o saldo a favor)
 * Un movimiento archivado no tiene efecto.
 */
export function balanceEffects(m: Movement): BalanceEffect[] {
  if (m.archived) return [];
  const amount = Number(m.amount) || 0;
  const currency: Currency = m.currency ?? "CRC";
  const account = (id: string, delta: number): BalanceEffect => ({
    target: "account",
    id,
    delta,
    currency,
  });
  const card = (id: string, delta: number): BalanceEffect => ({
    target: "card",
    id,
    delta,
    currency,
  });

  switch (m.type) {
    case "expense":
      if (m.account_id) return [account(m.account_id, -amount)];
      if (m.card_id) return [card(m.card_id, amount)];
      return [];
    case "income":
      return m.account_id ? [account(m.account_id, amount)] : [];
    case "opening_balance":
      if (m.account_id) return [account(m.account_id, amount)];
      if (m.card_id) return [card(m.card_id, amount)];
      return [];
    case "transfer":
      if (!m.account_id || !m.to_account_id) return [];
      return [account(m.account_id, -amount), account(m.to_account_id, amount)];
    case "card_payment": {
      const effects: BalanceEffect[] = [];
      if (m.account_id) effects.push(account(m.account_id, -amount));
      if (m.card_id) effects.push(card(m.card_id, -amount));
      return effects;
    }
  }
}

/** Saldo de una tarjeta por moneda (T1). */
export type CurrencyBalances = Partial<Record<Currency, number>>;

export type DerivedBalances = {
  /** Una cuenta tiene una sola moneda (C4). */
  accounts: Map<string, number>;
  /** Una tarjeta tiene un saldo por moneda (T1). */
  cards: Map<string, CurrencyBalances>;
};

/** Saldos por cuenta/tarjeta calculados solo desde los movimientos (G1). */
export function deriveBalances(movements: Movement[]): DerivedBalances {
  const accountCents = new Map<string, number>();
  const cardCents = new Map<string, Partial<Record<Currency, number>>>();
  for (const m of movements) {
    for (const e of balanceEffects(m)) {
      const delta = toCents(e.delta);
      if (e.target === "account") {
        accountCents.set(e.id, (accountCents.get(e.id) ?? 0) + delta);
      } else {
        const byCurrency = cardCents.get(e.id) ?? {};
        byCurrency[e.currency] = (byCurrency[e.currency] ?? 0) + delta;
        cardCents.set(e.id, byCurrency);
      }
    }
  }
  return {
    accounts: new Map([...accountCents].map(([id, c]) => [id, fromCents(c)])),
    cards: new Map(
      [...cardCents].map(([id, byCurrency]) => [
        id,
        Object.fromEntries(
          Object.entries(byCurrency).map(([cur, c]) => [cur, fromCents(c as number)]),
        ) as CurrencyBalances,
      ]),
    ),
  };
}

export type StoredBalance = {
  target: BalanceTarget;
  id: string;
  /** Saldo guardado (proyección, p. ej. `current_balance`). */
  stored: number;
  /** En tarjetas: de qué moneda es este saldo (default CRC). */
  currency?: Currency;
};

export type BalanceDrift = StoredBalance & {
  /** Saldo según los movimientos (la verdad, G1). */
  derived: number;
  /** stored − derived. */
  difference: number;
};

/**
 * G1: compara los saldos guardados con los derivados de los movimientos y
 * devuelve solo los que no coinciden (al céntimo).
 */
export function findBalanceDrift(stored: StoredBalance[], movements: Movement[]): BalanceDrift[] {
  const derived = deriveBalances(movements);
  const drift: BalanceDrift[] = [];
  for (const row of stored) {
    const d =
      row.target === "account"
        ? (derived.accounts.get(row.id) ?? 0)
        : (derived.cards.get(row.id)?.[row.currency ?? "CRC"] ?? 0);
    const diffCents = toCents(row.stored) - toCents(d);
    if (diffCents !== 0) {
      drift.push({ ...row, derived: d, difference: fromCents(diffCents) });
    }
  }
  return drift;
}

/**
 * Efecto con signo para historiales: ingreso +, gasto y abono −. Un saldo
 * inicial se muestra con su propio signo (en una tarjeta, + es deuda).
 */
export function signedAmount(m: Pick<Movement, "type" | "amount">): number {
  // Una transferencia se muestra desde la cuenta origen (sale dinero).
  if (m.type === "income" || m.type === "opening_balance") return Number(m.amount);
  return -Number(m.amount);
}

export type MovementDraft = {
  type: MovementType;
  amount: number;
  category?: string | null;
  /** Moneda de la cuenta involucrada (origen), si la hay. */
  accountCurrency?: Currency | null;
  /** Moneda del límite de la tarjeta involucrada, si la hay. */
  cardCurrency?: Currency | null;
  /**
   * Moneda elegida para un cargo o saldo inicial de tarjeta (T1: la tarjeta
   * acepta CRC y USD). Si falta, la del límite.
   */
  currency?: Currency | null;
  /** Transferencia: ids de origen y destino, y moneda del destino. */
  accountId?: string | null;
  toAccountId?: string | null;
  toAccountCurrency?: Currency | null;
  /** Gasto por SINPE. */
  channel?: MovementChannel | null;
  counterpartyPhone?: string | null;
};

/**
 * Teléfono de SINPE Móvil: 8 dígitos (Costa Rica). Acepta espacios, guiones y
 * el prefijo +506. Vacío → `null`. Inválido → `DomainError`.
 */
export function normalizeSinpePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let digits = raw.replace(/[\s-]/g, "");
  if (!digits) return null;
  digits = digits.replace(/^\+/, "");
  // Prefijo de país 506 solo si sobra (un número local puede empezar con 506).
  if (digits.length === 11 && digits.startsWith("506")) digits = digits.slice(3);
  if (!/^\d{8}$/.test(digits)) {
    throw new DomainError("S1", "El teléfono de SINPE debe tener 8 dígitos");
  }
  return digits;
}

/**
 * Valida un movimiento antes de registrarlo y devuelve su moneda (la del
 * origen). Lanza `DomainError` si rompe una regla.
 */
export function validateMovement(d: MovementDraft): Currency {
  if (d.type === "opening_balance") {
    // C1: monto con signo, distinto de 0, en exactamente una cuenta o tarjeta.
    if (!Number.isFinite(Number(d.amount)) || Number(d.amount) === 0) {
      throw new DomainError("C1", "El saldo inicial no puede ser 0");
    }
    if (Boolean(d.accountCurrency) === Boolean(d.cardCurrency)) {
      throw new DomainError("C1", "El saldo inicial es de una cuenta o de una tarjeta");
    }
    return d.accountCurrency ?? d.currency ?? d.cardCurrency!;
  }

  if (!(Number(d.amount) > 0)) {
    throw new DomainError("G2", "El monto debe ser mayor que 0");
  }

  if (d.type === "transfer") {
    // M2: entre dos cuentas propias distintas, en la misma moneda.
    if (!d.accountCurrency || !d.toAccountCurrency) {
      throw new DomainError("M2", "Una transferencia necesita una cuenta origen y una destino");
    }
    if (d.accountId && d.accountId === d.toAccountId) {
      throw new DomainError("M2", "La cuenta origen y la destino deben ser distintas");
    }
    assertSameCurrency(d.accountCurrency, d.toAccountCurrency, "M2");
    return d.accountCurrency;
  }

  if (d.channel === "sinpe") {
    // S1: un SINPE es un gasto desde una cuenta de débito.
    if (d.type !== "expense" || !d.accountCurrency || d.cardCurrency) {
      throw new DomainError("S1", "Un SINPE es un gasto desde una cuenta de débito");
    }
    normalizeSinpePhone(d.counterpartyPhone);
  }

  if (d.type === "card_payment") {
    // M3: un abono sale siempre de una cuenta de débito hacia una tarjeta.
    if (!d.accountCurrency || !d.cardCurrency) {
      throw new DomainError("M3", "Un abono necesita una cuenta de origen y una tarjeta");
    }
    // M5: el abono baja el saldo de la tarjeta en la moneda de la cuenta (T1),
    // sin conversión.
    return d.accountCurrency;
  }

  // M1: gasto e ingreso exigen categoría.
  if (!d.category || !d.category.trim()) {
    throw new DomainError("M1", "La categoría es obligatoria");
  }

  if (d.type === "income") {
    if (!d.accountCurrency) {
      throw new DomainError("M1", "Un ingreso entra siempre a una cuenta");
    }
    return d.accountCurrency;
  }

  // En una cuenta, su moneda; en una tarjeta, la elegida (T1) o la del límite.
  const currency = d.accountCurrency ?? (d.cardCurrency ? (d.currency ?? d.cardCurrency) : null);
  if (!currency) {
    throw new DomainError("M1", "Un gasto necesita una cuenta o una tarjeta");
  }
  return currency;
}
