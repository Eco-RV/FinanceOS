/**
 * Puertos: lo que los casos de uso necesitan del mundo exterior. La
 * infraestructura (hoy Supabase, en `src/infrastructure/`) los implementa;
 * los tests usan fakes en memoria. Ver `docs/dominio/arquitectura.md`.
 *
 * Todos los repositorios operan sobre los datos del usuario autenticado: el
 * aislamiento entre usuarios es responsabilidad del adaptador (RLS en Supabase).
 */

import type {
  Currency,
  ExchangeRate,
  Installment,
  ISODate,
  Movement,
  MovementChannel,
  MovementType,
  StoredBalance,
} from "../domain/index.ts";

export type NewMovement = {
  type: MovementType;
  amount: number;
  currency: Currency;
  occurred_on: ISODate;
  category: string | null;
  note: string | null;
  account_id: string | null;
  card_id: string | null;
  to_account_id?: string | null;
  channel?: MovementChannel | null;
  counterparty_name?: string | null;
  counterparty_phone?: string | null;
};

export type AccountFields = {
  name: string;
  type: string;
  institution: string | null;
  currency: Currency;
};

export type CardFields = {
  name: string;
  institution: string | null;
  last_four: string | null;
  credit_limit: number | null;
  cutoff_day: number;
  payment_due_day: number;
  currency: Currency;
  /** Se omite si el formulario no lo trae (compatibilidad pre-1.3.0). */
  bank_id?: string | null;
};

export interface AccountRepository {
  /** Moneda de una cuenta activa, o `null` si no existe. */
  currencyOf(accountId: string): Promise<Currency | null>;
  /** Crea (id `null`) o actualiza los datos de la cuenta. Nunca toca el saldo. */
  save(accountId: string | null, fields: AccountFields): Promise<{ id: string }>;
  delete(accountId: string): Promise<void>;
}

export interface CardRepository {
  /** Moneda de una tarjeta activa, o `null` si no existe. */
  currencyOf(cardId: string): Promise<Currency | null>;
  /** Crea (id `null`) o actualiza los datos de la tarjeta. Nunca toca el saldo. */
  save(cardId: string | null, fields: CardFields): Promise<{ id: string }>;
  delete(cardId: string): Promise<void>;
}

export type OpeningBalance = { id: string; amount: number; occurred_on: ISODate };

export interface MovementRepository {
  /** Tarjeta a la que pertenece un movimiento (para refrescar su vista). */
  cardIdOf(movementId: string): Promise<string | null>;
  /**
   * Saldo inicial activo de una cuenta o tarjeta en una moneda (C1: como
   * máximo uno por moneda; una cuenta tiene una sola).
   */
  openingOf(
    target: "account" | "card",
    id: string,
    currency: Currency,
  ): Promise<OpeningBalance | null>;
  create(movement: NewMovement): Promise<{ id: string }>;
  update(movementId: string, movement: NewMovement): Promise<void>;
  delete(movementId: string): Promise<void>;
}

export type NewFinancing = {
  card_id: string;
  description: string;
  category: string | null;
  total_amount: number;
  months: number;
  first_charge_on: ISODate;
};

export interface FinancingRepository {
  /** Guarda el plan y exactamente estas cuotas, de forma atómica. */
  createWithInstallments(plan: NewFinancing, installments: Installment[]): Promise<{ id: string }>;
  cardIdOf(financingId: string): Promise<string | null>;
  /**
   * F4: borra las cuotas con fecha posterior a `todayISO`, conserva las demás y
   * marca el plan como cancelado (o lo borra si no quedó ninguna cuota).
   */
  cancel(financingId: string, todayISO: ISODate): Promise<"cancelled" | "deleted">;
}

export type PendingPurchase = {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  occurred_on: ISODate;
};

export interface PendingRepository {
  /** Un pendiente que todavía está por confirmar, o `null`. */
  findOpen(pendingId: string): Promise<PendingPurchase | null>;
  markApproved(pendingId: string, movementId: string, cardId: string): Promise<void>;
  markRejected(pendingId: string): Promise<void>;
}

export interface MerchantRuleRepository {
  /** Guarda (o actualiza) la categoría aprendida para un comercio. */
  learn(merchantKey: string, category: string): Promise<void>;
}

export interface BalanceRepository {
  /** Saldos guardados (proyección) de todas las cuentas y tarjetas. */
  stored(): Promise<StoredBalance[]>;
  /** Todos los movimientos que afectan saldos (la verdad, G1). */
  movements(): Promise<Movement[]>;
  /** Reescribe los saldos guardados desde los movimientos. Devuelve filas cambiadas. */
  recompute(): Promise<number>;
}

export interface ExchangeRateRepository {
  /** Último tipo de cambio digitado (T2), o `null` si no hay ninguno. */
  latest(): Promise<ExchangeRate | null>;
  /** Guarda (o reemplaza) el tipo de cambio de una fecha. */
  save(rate: ExchangeRate): Promise<void>;
}

/** Error de un adaptador que se puede mostrar al usuario. */
export class InfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfrastructureError";
  }
}
