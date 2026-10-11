/**
 * Libro de movimientos: la **fuente de verdad** (G1). Todo saldo de cuenta o
 * tarjeta se deriva de aquí. El trigger `transactions_balance_sync` de Postgres
 * mantiene una copia (`current_balance`) con exactamente estas mismas reglas de
 * signo; `deriveBalances` permite verificarla.
 */

import { DomainError } from "../shared/errors.ts";
import { assertSameCurrency, fromCents, toCents, type Currency } from "../shared/money.ts";

export const MOVEMENT_TYPES = ["expense", "income", "card_payment", "opening_balance"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type Movement = {
  type: MovementType;
  amount: number;
  account_id: string | null;
  card_id: string | null;
  archived?: boolean;
};

export type BalanceTarget = "account" | "card";

export type BalanceEffect = {
  target: BalanceTarget;
  id: string;
  /** Cambio en el saldo guardado (cuenta: disponible; tarjeta: deuda). */
  delta: number;
};

/**
 * Efecto de un movimiento sobre los saldos. Convención de signo:
 * - gasto en cuenta: cuenta **−**
 * - gasto con tarjeta: deuda **+**
 * - ingreso: cuenta **+**
 * - abono (`card_payment`): cuenta **−** y deuda **−**
 * - saldo inicial (`opening_balance`, C1): cuenta **+monto** / deuda **+monto**;
 *   es el único tipo con monto **con signo** (sobregiro inicial o saldo a favor)
 * Un movimiento archivado no tiene efecto.
 */
export function balanceEffects(m: Movement): BalanceEffect[] {
  if (m.archived) return [];
  const amount = Number(m.amount) || 0;

  switch (m.type) {
    case "expense":
      if (m.account_id) return [{ target: "account", id: m.account_id, delta: -amount }];
      if (m.card_id) return [{ target: "card", id: m.card_id, delta: amount }];
      return [];
    case "income":
      return m.account_id ? [{ target: "account", id: m.account_id, delta: amount }] : [];
    case "opening_balance":
      if (m.account_id) return [{ target: "account", id: m.account_id, delta: amount }];
      if (m.card_id) return [{ target: "card", id: m.card_id, delta: amount }];
      return [];
    case "card_payment": {
      const effects: BalanceEffect[] = [];
      if (m.account_id) effects.push({ target: "account", id: m.account_id, delta: -amount });
      if (m.card_id) effects.push({ target: "card", id: m.card_id, delta: -amount });
      return effects;
    }
  }
}

export type DerivedBalances = {
  accounts: Map<string, number>;
  cards: Map<string, number>;
};

/** Saldos por cuenta/tarjeta calculados solo desde los movimientos (G1). */
export function deriveBalances(movements: Movement[]): DerivedBalances {
  const cents = { account: new Map<string, number>(), card: new Map<string, number>() };
  for (const m of movements) {
    for (const e of balanceEffects(m)) {
      const map = cents[e.target];
      map.set(e.id, (map.get(e.id) ?? 0) + toCents(e.delta));
    }
  }
  const toAmounts = (map: Map<string, number>) =>
    new Map([...map].map(([id, c]) => [id, fromCents(c)]));
  return { accounts: toAmounts(cents.account), cards: toAmounts(cents.card) };
}

export type StoredBalance = {
  target: BalanceTarget;
  id: string;
  /** Saldo guardado (proyección, p. ej. `current_balance`). */
  stored: number;
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
    const map = row.target === "account" ? derived.accounts : derived.cards;
    const d = map.get(row.id) ?? 0;
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
  if (m.type === "income" || m.type === "opening_balance") return Number(m.amount);
  return -Number(m.amount);
}

export type MovementDraft = {
  type: MovementType;
  amount: number;
  category?: string | null;
  /** Moneda de la cuenta involucrada, si la hay. */
  accountCurrency?: Currency | null;
  /** Moneda de la tarjeta involucrada, si la hay. */
  cardCurrency?: Currency | null;
};

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
    return (d.accountCurrency ?? d.cardCurrency)!;
  }

  if (!(Number(d.amount) > 0)) {
    throw new DomainError("G2", "El monto debe ser mayor que 0");
  }

  if (d.type === "card_payment") {
    // M3: un abono sale siempre de una cuenta de débito hacia una tarjeta.
    if (!d.accountCurrency || !d.cardCurrency) {
      throw new DomainError("M3", "Un abono necesita una cuenta de origen y una tarjeta");
    }
    // M5: sin conversión de moneda en un abono.
    assertSameCurrency(d.accountCurrency, d.cardCurrency, "M5");
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

  const currency = d.accountCurrency ?? d.cardCurrency;
  if (!currency) {
    throw new DomainError("M1", "Un gasto necesita una cuenta o una tarjeta");
  }
  return currency;
}
