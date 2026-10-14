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
  FinancingInstallment,
  FreshStartOpening,
  FreshStartProduct,
  ISODate,
  MemberShare,
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
  /** Pago de cuota (con `installment_no`) o desembolso (sin) de un préstamo. */
  loan_id?: string | null;
  installment_no?: number | null;
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

/** Lo mínimo para aplicar G4/G5 sobre algo del catálogo del usuario. */
export type CatalogEntry = { name: string; archived: boolean };

/**
 * Operaciones de ciclo de vida (G5) comunes a cuentas, tarjetas, categorías y
 * bancos. `historyCount` cuenta lo que impide eliminar (ver
 * `src/domain/catalog/lifecycle.ts`).
 */
export interface LifecycleRepository<Entry extends CatalogEntry = CatalogEntry> {
  /** Activo o desactivado; `null` si no existe. */
  find(id: string): Promise<Entry | null>;
  historyCount(id: string): Promise<number>;
  setArchived(id: string, archived: boolean): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface AccountRepository extends LifecycleRepository {
  /** Moneda de una cuenta activa, o `null` si no existe. */
  currencyOf(accountId: string): Promise<Currency | null>;
  /** Crea (id `null`) o actualiza los datos de la cuenta. Nunca toca el saldo. */
  save(accountId: string | null, fields: AccountFields): Promise<{ id: string }>;
}

export interface CardRepository extends LifecycleRepository<CatalogEntry & { bank_id: string | null }> {
  /** Moneda de una tarjeta activa, o `null` si no existe. */
  currencyOf(cardId: string): Promise<Currency | null>;
  /** Crea (id `null`) o actualiza los datos de la tarjeta. Nunca toca el saldo. */
  save(cardId: string | null, fields: CardFields): Promise<{ id: string }>;
}

export type CategoryKind = "expense" | "income";

export type CategoryFields = { kind: CategoryKind; name: string };

export interface CategoryRepository extends LifecycleRepository<CatalogEntry & { kind: CategoryKind }> {
  /**
   * Crea o actualiza. Un nombre repetido (sin mayúsculas) entre las activas
   * del mismo tipo lanza `InfrastructureError`.
   */
  save(categoryId: string | null, fields: CategoryFields): Promise<{ id: string }>;
  /** Nombres de todas las categorías de un tipo, activas o no. */
  names(kind: CategoryKind): Promise<string[]>;
  createMany(rows: CategoryFields[]): Promise<void>;
  /** G4: el nombre solo existe desactivado (no hay una activa que se llame igual). */
  isDeactivated(kind: CategoryKind, name: string): Promise<boolean>;
}

export type BankFields = {
  name: string;
  sender_emails: string[];
  parser_key: string;
  enabled: boolean;
};

export interface BankRepository extends LifecycleRepository {
  save(bankId: string | null, fields: BankFields): Promise<{ id: string }>;
}

export type OpeningBalance = { id: string; amount: number; occurred_on: ISODate };

export interface MovementRepository {
  /** Tarjeta a la que pertenece un movimiento (para refrescar su vista). */
  cardIdOf(movementId: string): Promise<string | null>;
  /** Categoría que tiene hoy un movimiento (G4 al editar), o `null`. */
  categoryOf(movementId: string): Promise<string | null>;
  /** Préstamo al que pertenece un movimiento (pago o desembolso), o `null`. */
  loanIdOf(movementId: string): Promise<string | null>;
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
  /** Capital financiado (en tasa 0, el total de la compra). */
  total_amount: number;
  /** Tasa anual en porcentaje; 0 = sin interés. */
  annual_rate: number;
  months: number;
  first_charge_on: ISODate;
};

export type FinancingFields = { description: string; category: string | null };

export type StoredFinancing = {
  id: string;
  card_id: string;
  description: string;
  months: number;
  currency: Currency;
  cancelled_on: ISODate | null;
};

export interface FinancingRepository {
  /** Guarda el plan y exactamente estas cuotas, de forma atómica. */
  createWithInstallments(
    plan: NewFinancing,
    installments: FinancingInstallment[],
  ): Promise<{ id: string }>;
  find(financingId: string): Promise<StoredFinancing | null>;
  cardIdOf(financingId: string): Promise<string | null>;
  /** F9: cambia descripción y categoría del plan y de sus cuotas. */
  update(financingId: string, fields: FinancingFields): Promise<void>;
  /** Cuotas que existen hoy (activas), con su monto. */
  installments(financingId: string): Promise<{ no: number; amount: number; occurred_on: ISODate }[]>;
  /**
   * F4: borra las cuotas con fecha posterior a `todayISO`, conserva las demás y
   * marca el plan como cancelado (o lo borra si no quedó ninguna cuota).
   */
  cancel(financingId: string, todayISO: ISODate): Promise<"cancelled" | "deleted">;
  /** F6: parte fija por cuota de cada miembro. */
  shares(financingId: string): Promise<MemberShare[]>;
  replaceShares(financingId: string, shares: MemberShare[]): Promise<void>;
}

export type MemberFields = { name: string; email: string | null; phone: string | null };

export type Member = MemberFields & { id: string; archived: boolean };

export interface MemberRepository extends LifecycleRepository<Member> {
  /** Un nombre repetido entre los activos lanza `InfrastructureError`. */
  save(memberId: string | null, fields: MemberFields): Promise<{ id: string }>;
}

export const REIMBURSEMENT_CHANNELS = ["sinpe", "efectivo", "transferencia", "otro"] as const;
export type ReimbursementChannel = (typeof REIMBURSEMENT_CHANNELS)[number];

export type NewReimbursement = {
  financing_id: string;
  member_id: string;
  installment_no: number;
  amount: number;
  paid_on: ISODate;
  channel: ReimbursementChannel;
  note: string | null;
};

export interface ReimbursementRepository {
  /** F7: una vez por parte; repetir lanza `InfrastructureError`. */
  create(reimbursement: NewReimbursement): Promise<{ id: string }>;
  /** Miembros con algún reembolso en un financiamiento. */
  membersWithReimbursements(financingId: string): Promise<string[]>;
  /** Borra un reembolso y devuelve su financiamiento, o `null` si no existía. */
  delete(reimbursementId: string): Promise<string | null>;
}

export type NoticeChannel = "email" | "whatsapp";

export type NewNotice = {
  financing_id: string;
  member_id: string;
  installment_no: number;
  quincenas: number;
  channel: NoticeChannel;
};

export interface NoticeRepository {
  record(notices: NewNotice[]): Promise<void>;
}

export type OutgoingMail = { to: string; subject: string; text: string };

/** Envío de correo desde la cuenta del usuario (F8). */
export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
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

export type LoanFields = {
  name: string;
  lender: string | null;
  principal: number;
  annual_rate: number;
  months: number;
  currency: Currency;
  first_payment_on: ISODate;
  /** Cuenta sugerida para pagar las cuotas. */
  account_id: string | null;
};

export type Loan = LoanFields & { id: string; archived: boolean };

export interface LoanRepository extends LifecycleRepository<Loan> {
  create(fields: LoanFields): Promise<{ id: string }>;
  /** Renombra o cambia el prestamista o la cuenta sugerida (no los términos). */
  rename(loanId: string, fields: Pick<LoanFields, "name" | "lender" | "account_id">): Promise<void>;
  /** Números de cuota pagados (movimientos activos). */
  paidInstallments(loanId: string): Promise<number[]>;
  /** Movimiento del pago de una cuota, o `null`. */
  paymentOf(loanId: string, installmentNo: number): Promise<string | null>;
}

export interface FreshStartRepository {
  /** Cuentas y tarjetas activas, con las monedas que necesitan saldo inicial. */
  activeProducts(): Promise<FreshStartProduct[]>;
  /**
   * M8, atómico: borra cuotas pendientes de financiamientos, archiva todos los
   * movimientos, borra financiamientos y préstamos y crea estos saldos
   * iniciales en `on`. Devuelve cuántos movimientos archivó.
   */
  run(todayISO: ISODate, on: ISODate, openings: FreshStartOpening[]): Promise<number>;
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
