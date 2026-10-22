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
  FeedbackKind,
  FeedbackStatus,
  ExchangeRate,
  FinancingInstallment,
  FreshStartOpening,
  FreshStartProduct,
  ISODate,
  MemberShare,
  Movement,
  MovementChannel,
  MovementType,
  Frequency,
  PlanKind,
  ProfileFields,
  StoredBalance,
  DebitCardEntry,
  DebitCardFields,
  AcademyLesson,
  StarLabelFields,
  CardCycle,
  AmortizationEvent,
  PendingInstallment,
  PrepaymentMode,
  SharedPartState,
  SharedPaymentChannel,
  SharedShare,
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
  /** Ocurrencia de un plan recurrente (2.7.0). */
  plan_id?: string | null;
  /** Gasto de cuenta pagado con su tarjeta de débito (2.8.0). */
  debit_card_id?: string | null;
  /** Abono en otra moneda (M5, 2.8.0): sale de la cuenta, en su moneda. */
  account_amount?: number | null;
  /** Abono en otra moneda (M5, 2.8.0): colones por dólar usados. */
  exchange_rate?: number | null;
  /** P7 (3.1.0): ocurrencia de un plan variable con el monto estimado. */
  estimated?: boolean;
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
  /** T3 (2.8.0): las compras del día de corte entran al corte siguiente. */
  cutoff_day_rolls_over?: boolean;
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
  /** Tipo (checking/savings/cash) de una cuenta activa, o `null` si no existe. */
  typeOf(accountId: string): Promise<string | null>;
  /** Crea (id `null`) o actualiza los datos de la cuenta. Nunca toca el saldo. */
  save(accountId: string | null, fields: AccountFields): Promise<{ id: string }>;
}

export interface CardRepository extends LifecycleRepository<CatalogEntry & { bank_id: string | null }> {
  /** Moneda de una tarjeta activa, o `null` si no existe. */
  currencyOf(cardId: string): Promise<Currency | null>;
  /** Crea (id `null`) o actualiza los datos de la tarjeta. Nunca toca el saldo. */
  save(cardId: string | null, fields: CardFields): Promise<{ id: string }>;
}

export type DebitCardInput = DebitCardFields & { account_id: string };

/** Tarjetas de débito (2.8.0, C3): una activa por cuenta bancaria. */
export interface DebitCardRepository extends LifecycleRepository<DebitCardEntry> {
  /**
   * Crea o actualiza. Otra tarjeta activa en la misma cuenta lanza
   * `InfrastructureError` (C3).
   */
  save(debitCardId: string | null, fields: DebitCardInput): Promise<{ id: string }>;
}

export type CategoryKind = "expense" | "income";

/** `icon` (2.5.0): clave del kit de íconos; sin definir = no se toca. */
export type CategoryFields = { kind: CategoryKind; name: string; icon?: string | null };

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
  /** Tarjeta de débito con la que se pagó un movimiento, o `null`. */
  debitCardOf(movementId: string): Promise<string | null>;
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
  /** F10 (3.1.0): moneda del plan; por defecto la del límite de la tarjeta. */
  currency?: Currency;
};

export type FinancingFields = { description: string; category: string | null };

export type StoredFinancing = {
  id: string;
  card_id: string;
  description: string;
  months: number;
  currency: Currency;
  cancelled_on: ISODate | null;
  /** 3.1.0 (F11): tasa y categoría, para recalcular tras un abono. */
  annual_rate?: number;
  category?: string | null;
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
  /** F11 (3.1.0): cuotas programadas (fecha > hoy) con su interés. */
  pendingInstallments(financingId: string, todayISO: ISODate): Promise<PendingInstallment[]>;
  /**
   * F11, atómico: reemplaza las cuotas programadas desde `fromNo` por estas y
   * guarda las anteriores para poder deshacerlo.
   */
  prepay(
    financingId: string,
    input: {
      todayISO: ISODate;
      fromNo: number;
      installments: FinancingInstallment[];
      amount: number;
      mode: PrepaymentMode;
      occurred_on: ISODate;
      transaction_id: string;
    },
  ): Promise<{ id: string }>;
  /** Último abono del plan (el único que se puede deshacer), o `null`. */
  lastPrepayment(financingId: string): Promise<{ id: string; amount: number; occurred_on: ISODate } | null>;
  /** Vuelve al plan anterior y borra el gasto del abono. */
  undoPrepayment(prepaymentId: string, todayISO: ISODate): Promise<void>;
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

/** Gasto compartido (3.1.0): el movimiento que se comparte y, si es de tarjeta, su ciclo. */
export type SharedSource = {
  movement_id: string;
  type: MovementType;
  amount: number;
  currency: Currency;
  occurred_on: ISODate;
  account_id: string | null;
  card: (CardCycle & { id: string }) | null;
  note: string | null;
  /** Cuotas de financiamiento y movimientos de préstamo se gestionan en su módulo. */
  managed_elsewhere: boolean;
};

export type SharedPartRecord = SharedPartState & {
  channel: SharedPaymentChannel | null;
  note: string | null;
  income_transaction_id: string | null;
};

export type StoredSharedExpense = {
  id: string;
  transaction_id: string;
  description: string;
  currency: Currency;
  total_amount: number;
  occurred_on: ISODate;
  due_on: ISODate;
  /** X3: la fecha límite sale de la tarjeta (no se edita a mano). */
  card_id: string | null;
  parts: SharedPartRecord[];
};

export type SharedPayment = {
  paid_on: ISODate;
  channel: SharedPaymentChannel;
  note: string | null;
  income_transaction_id: string | null;
};

export type NewSharedNotice = {
  shared_expense_id: string;
  member_id: string;
  quincenas: number;
  channel: NoticeChannel;
};

/** Para qué está ligado un movimiento a un gasto compartido (X6). */
export type SharedLink = { shared_expense_id: string; role: "expense" | "income" };

export interface SharedExpenseRepository {
  /** El movimiento a compartir (activo), o `null`. */
  source(movementId: string): Promise<SharedSource | null>;
  /** Si el movimiento es el gasto de un compartido o el ingreso de un pago. */
  linkOf(movementId: string): Promise<SharedLink | null>;
  find(id: string): Promise<StoredSharedExpense | null>;
  /** Un movimiento ya compartido lanza `InfrastructureError`. */
  create(input: {
    transaction_id: string;
    description: string;
    currency: Currency;
    total_amount: number;
    due_on: ISODate;
    shares: SharedShare[];
  }): Promise<{ id: string }>;
  /** Cambia descripción y fecha, y reemplaza las partes (las pagadas se conservan iguales). */
  update(id: string, fields: { description: string; due_on: ISODate; shares: SharedShare[] }): Promise<void>;
  /** Marca (o desmarca con `null`) el pago de la parte de una persona. */
  setPayment(id: string, memberId: string, payment: SharedPayment | null): Promise<void>;
  delete(id: string): Promise<void>;
  recordNotices(items: NewSharedNotice[]): Promise<void>;
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
  /** 3.1.0 (I6): cambiar la categoría de una regla o borrarla. */
  update(ruleId: string, category: string): Promise<void>;
  delete(ruleId: string): Promise<void>;
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
  /** 3.1.0: abonos extraordinarios (L7) y cambios de tasa (L8), en el orden en que se hicieron. */
  adjustments(loanId: string): Promise<StoredLoanAdjustment[]>;
  addAdjustment(
    loanId: string,
    input: { event: AmortizationEvent; occurred_on: ISODate; transaction_id: string | null },
  ): Promise<{ id: string }>;
  deleteAdjustment(adjustmentId: string): Promise<void>;
}

export type StoredLoanAdjustment = {
  id: string;
  event: AmortizationEvent;
  occurred_on: ISODate;
  /** El gasto del abono (L7); `null` en un cambio de tasa. */
  transaction_id: string | null;
};

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
  /** Último tipo de cambio guardado (T2), o `null` si no hay ninguno. */
  latest(): Promise<ExchangeRate | null>;
  /** Guarda (o reemplaza) el tipo de cambio de una fecha. */
  save(rate: ExchangeRate): Promise<void>;
}

/** T8 (3.1.0): pago mínimo digitado del estado de cuenta, por corte y moneda. */
export type MinimumPayment = {
  card_id: string;
  /** Fecha del corte al que pertenece. */
  cutoff_on: ISODate;
  currency: Currency;
  amount: number;
};

export interface MinimumPaymentRepository {
  /** Guarda o reemplaza el mínimo de ese corte y moneda. */
  save(m: MinimumPayment): Promise<void>;
  delete(key: Omit<MinimumPayment, "amount">): Promise<void>;
}

/**
 * Fuente oficial del tipo de cambio (3.1.0, T10): hoy la API pública de
 * Hacienda, que publica el de referencia del BCCR (venta). Lanza
 * `InfrastructureError` si no responde.
 */
export interface ExchangeRateSource {
  today(): Promise<ExchangeRate>;
}

/** Error de un adaptador que se puede mostrar al usuario. */
export class InfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfrastructureError";
  }
}

// ─────────────────────────────  cuenta del usuario (2.6.0)  ─────────────────────────────

/** Perfil guardado del usuario autenticado (todo opcional). */
export type Profile = ProfileFields & {
  avatar_url: string | null;
  preferences: Record<string, unknown>;
};

export interface ProfileRepository {
  /** Perfil del usuario, o `null` si no tiene (o la tabla todavía no existe). */
  get(): Promise<Profile | null>;
  /** Crea o actualiza el perfil. Un usuario (@) repetido lanza `InfrastructureError` (U1). */
  save(fields: ProfileFields): Promise<void>;
  setAvatarUrl(url: string | null): Promise<void>;
  /** Mezcla preferencias nuevas con las guardadas. */
  savePreferences(preferences: Record<string, unknown>): Promise<void>;
}

/** Correo y contraseña del usuario (proveedor de autenticación). */
export interface IdentityService {
  email(): Promise<string | null>;
  /** Comprueba la contraseña actual sin cambiar la sesión de forma visible. */
  verifyPassword(password: string): Promise<boolean>;
  changePassword(next: string): Promise<void>;
  /** La sesión viene del enlace de "olvidé mi contraseña" (hace menos de una hora). */
  isRecoverySession(): Promise<boolean>;
  /** Pide el cambio: el proveedor manda la confirmación al correo nuevo (y al actual). */
  changeEmail(next: string, redirectTo: string): Promise<void>;
  /** U8 (3.1.0): borra la cuenta y TODOS sus datos (archivos incluidos). No se deshace. */
  deleteAccount(): Promise<void>;
}

/** G8 (3.1.0): comprobantes privados de los movimientos. */
export interface ReceiptStorage {
  /** Sube el archivo y lo liga al movimiento (reemplaza el anterior). */
  attach(movementId: string, file: { bytes: ArrayBuffer; type: string }): Promise<void>;
  /** Enlace temporal para verlo, o `null` si no tiene. */
  urlOf(movementId: string): Promise<string | null>;
  remove(movementId: string): Promise<void>;
}

/** Foto de perfil en un almacenamiento de archivos. */
export interface AvatarStorage {
  /** Sube la foto y devuelve su URL pública. */
  upload(file: { bytes: ArrayBuffer; type: string }): Promise<string>;
  remove(): Promise<void>;
}

// ─────────────────────────────  planes y metas (2.7.0)  ─────────────────────────────

export type PlanFields = {
  kind: PlanKind;
  name: string;
  amount: number;
  currency: Currency;
  frequency: Frequency;
  starts_on: ISODate;
  ends_on: ISODate | null;
  account_id: string | null;
  card_id: string | null;
  /** Gasto fijo con tarjeta de débito (2.8.0): `account_id` es su cuenta. */
  debit_card_id?: string | null;
  category: string | null;
  note: string | null;
  /** P7 (3.1.0): el monto es un estimado; cada ocurrencia se confirma. */
  variable?: boolean;
};

/** P7: ocurrencia registrada con el monto estimado, por confirmar. */
export type EstimatedOccurrence = {
  movement_id: string;
  plan_id: string;
  plan_name: string;
  kind: PlanKind;
  occurred_on: ISODate;
  amount: number;
  currency: Currency;
};

export type Plan = PlanFields & {
  id: string;
  /** Última fecha ya registrada como movimiento (M7). */
  generated_through: ISODate | null;
  archived: boolean;
};

export interface PlanRepository {
  list(): Promise<Plan[]>;
  find(planId: string): Promise<Plan | null>;
  /** Crea (id `null`, con `generated_through`) o actualiza los datos del plan. */
  save(planId: string | null, fields: PlanFields, generatedThrough?: ISODate | null): Promise<{ id: string }>;
  /** Pausa o reanuda; al reanudar se fija desde dónde vuelve a registrar. */
  setArchived(planId: string, archived: boolean, generatedThrough?: ISODate | null): Promise<void>;
  /** P3: borra el plan; sus movimientos ya registrados quedan sin plan. */
  delete(planId: string): Promise<void>;
  /** Registra ocurrencias (idempotente por fecha) y avanza `generated_through`. */
  materialize(planId: string, through: ISODate, rows: NewMovement[]): Promise<number>;
  /** P7 (3.1.0): ocurrencias con monto estimado que falta confirmar. */
  estimatedOccurrences(): Promise<EstimatedOccurrence[]>;
  /** P7: fija el monto real (el saldo se ajusta) y la marca como confirmada. */
  confirmOccurrence(movementId: string, amount: number): Promise<void>;
}

export type GoalFields = {
  name: string;
  target_amount: number;
  currency: Currency;
  target_date: ISODate | null;
  account_id: string | null;
  icon: string | null;
};

export type Goal = GoalFields & { id: string; archived: boolean; allocated?: number };

export interface GoalRepository {
  find(goalId: string): Promise<Goal | null>;
  save(goalId: string | null, fields: GoalFields): Promise<{ id: string }>;
  /** A4 (3.1.0): metas activas ligadas a una cuenta, con su apartado. */
  onAccount(accountId: string): Promise<{ id: string; allocated: number }[]>;
  /** Saldo de la cuenta (para validar los apartados), o `null`. */
  accountBalance(accountId: string): Promise<number | null>;
  setAllocated(goalId: string, allocated: number): Promise<void>;
  setArchived(goalId: string, archived: boolean): Promise<void>;
  delete(goalId: string): Promise<void>;
}

// ─────────────────────────────  Constelación familiar (3.0.0)  ─────────────────────────────

export type WalletConnectorKind = "cavos" | "extension";

/** Wallet de Stellar ligada al usuario (solo la dirección pública). */
export type LinkedWallet = { address: string; connector: WalletConnectorKind };

export interface WalletLinkRepository {
  current(): Promise<LinkedWallet | null>;
  /**
   * Liga una dirección (reemplaza la anterior). Una dirección ligada a otro
   * usuario lanza `InfrastructureError`.
   */
  link(wallet: LinkedWallet): Promise<void>;
  unlink(): Promise<void>;
}

export type StarLabel = StarLabelFields & { id: string };

/** Agenda del usuario: cómo llama él a cada dirección (D3, K2: fuera de la cadena). */
export interface StarDirectoryRepository {
  list(): Promise<StarLabel[]>;
  /** Una dirección repetida en la agenda lanza `InfrastructureError`. */
  save(starId: string | null, fields: StarLabelFields): Promise<{ id: string }>;
  delete(starId: string): Promise<void>;
}

export type InviteRole = "guardian" | "member";

export type FamilyInvite = {
  id: string;
  family_id: number;
  role: InviteRole;
  expires_at: string;
  redeemed_address: string | null;
  redeemed_at: string | null;
  added_at: string | null;
  revoked: boolean;
};

export type NewFamilyInvite = {
  family_id: number;
  role: InviteRole;
  /** SHA-256 (hex) del token; el token en claro nunca se guarda. */
  token_hash: string;
  expires_at: string;
};

export interface FamilyInviteRepository {
  create(invite: NewFamilyInvite): Promise<{ id: string }>;
  /** Invitaciones creadas por el usuario. */
  listMine(): Promise<FamilyInvite[]>;
  find(inviteId: string): Promise<FamilyInvite | null>;
  revoke(inviteId: string): Promise<void>;
  /** El núcleo ya agregó en la cadena la dirección que canjeó la invitación. */
  markAdded(inviteId: string): Promise<void>;
  /**
   * Canjea una invitación vigente con la dirección del usuario actual. Una
   * invitación vencida, revocada, usada o inexistente lanza `InfrastructureError`.
   */
  redeem(token: string, address: string): Promise<{ family_id: number; role: InviteRole }>;
}

/** Tokens de invitación: aleatorio + su hash (lo genera la infraestructura). */
export interface InviteTokenService {
  newToken(): { token: string; hash: string };
}

export type AcademyProgress = { lesson: AcademyLesson; score: number; completed_at: string };

export interface AcademyRepository {
  list(): Promise<AcademyProgress[]>;
  /** Guarda el mejor puntaje de una lección. */
  record(lesson: AcademyLesson, score: number): Promise<void>;
}

/** 3.2.0 (B1–B6): una publicación del buzón de comentarios. */
export type FeedbackPostRecord = {
  id: string;
  user_id: string;
  author_name: string;
  kind: FeedbackKind;
  title: string;
  status: FeedbackStatus;
  has_attachment: boolean;
  user_activity_at: string;
  admin_activity_at: string | null;
  user_read_at: string;
  admin_read_at: string | null;
  created_at: string;
};

export type FeedbackMessageRecord = {
  id: string;
  post_id: string;
  from_admin: boolean;
  body: string;
  created_at: string;
};

/** 3.2.0: buzón de comentarios (privado entre el usuario y el admin, B2). */
export interface FeedbackRepository {
  /** Crea la publicación con su primer mensaje (el texto). */
  create(input: { author_name: string; kind: FeedbackKind; title: string; body: string }): Promise<{ id: string }>;
  /** B4: sube la captura y la liga a la publicación. */
  attach(postId: string, file: { bytes: ArrayBuffer; type: string }): Promise<void>;
  /** Enlace temporal de la captura, o `null` si no tiene. */
  attachmentUrl(postId: string): Promise<string | null>;
  /** Las publicaciones propias, la actividad más reciente primero. */
  mine(): Promise<FeedbackPostRecord[]>;
  /** Todas (solo el admin las ve: RLS). */
  all(): Promise<FeedbackPostRecord[]>;
  find(postId: string): Promise<FeedbackPostRecord | null>;
  messages(postId: string): Promise<FeedbackMessageRecord[]>;
  reply(postId: string, body: string, fromAdmin: boolean): Promise<void>;
  setStatus(postId: string, status: FeedbackStatus): Promise<void>;
  /** B5: marca leída la publicación del lado que corresponda. */
  markRead(postId: string, side: "user" | "admin"): Promise<void>;
  /** B5: sin leer propias (`mine`) y en la bandeja del admin (`inbox`). */
  unread(): Promise<{ mine: number; inbox: number }>;
}
