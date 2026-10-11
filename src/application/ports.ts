/**
 * Puertos: lo que los casos de uso necesitan del mundo exterior. La
 * infraestructura (hoy Supabase, en `src/infrastructure/`) los implementa;
 * los tests usan fakes en memoria. Ver `docs/dominio/arquitectura.md`.
 *
 * Todos los repositorios operan sobre los datos del usuario autenticado: el
 * aislamiento entre usuarios es responsabilidad del adaptador (RLS en Supabase).
 */

import type { Currency, ISODate, MovementType } from "../domain/index.ts";

export type NewMovement = {
  type: MovementType;
  amount: number;
  currency: Currency;
  occurred_on: ISODate;
  category: string | null;
  note: string | null;
  account_id: string | null;
  card_id: string | null;
};

export interface AccountRepository {
  /** Moneda de una cuenta activa, o `null` si no existe. */
  currencyOf(accountId: string): Promise<Currency | null>;
}

export interface CardRepository {
  /** Moneda de una tarjeta activa, o `null` si no existe. */
  currencyOf(cardId: string): Promise<Currency | null>;
}

export interface MovementRepository {
  /** Tarjeta a la que pertenece un movimiento (para refrescar su vista). */
  cardIdOf(movementId: string): Promise<string | null>;
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
  /** Crea el plan y todas sus cuotas de forma atómica. */
  createWithInstallments(plan: NewFinancing): Promise<{ id: string }>;
  cardIdOf(financingId: string): Promise<string | null>;
  delete(financingId: string): Promise<void>;
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

/** Error de un adaptador que se puede mostrar al usuario. */
export class InfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfrastructureError";
  }
}
