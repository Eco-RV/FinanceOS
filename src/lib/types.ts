export type AccountType = "checking" | "savings" | "cash";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  currency: string;
  current_balance: number;
  archived: boolean;
  created_at: string;
};

export type CreditCard = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  last_four: string | null;
  bank_id: string | null;
  credit_limit: number | null;
  cutoff_day: number;
  payment_due_day: number;
  /** T3 (2.8.0): las compras del día de corte entran al corte siguiente. */
  cutoff_day_rolls_over?: boolean;
  /** Saldo en CRC (proyección). */
  current_balance: number;
  /** Saldo en USD (proyección, 2.0.0 — tarjeta bimoneda). */
  usd_balance?: number;
  /** Moneda del límite de crédito (2.0.0). */
  currency: string;
  archived: boolean;
  created_at: string;
};

export type TransactionType =
  | "expense"
  | "income"
  | "card_payment"
  | "opening_balance"
  | "transfer";

/** Saldo inicial de una cuenta o tarjeta (movimiento `opening_balance`, C1). */
export type OpeningBalance = { amount: number; occurred_on: string };

export type Transaction = {
  /** G8 (3.0.1): ruta del comprobante en el bucket privado `receipts`. */
  receipt_path?: string | null;
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  occurred_on: string; // "YYYY-MM-DD"
  category: string | null;
  note: string | null;
  account_id: string | null;
  card_id: string | null;
  financing_id: string | null;
  installment_no: number | null;
  /** Parte de una cuota de financiamiento que es interés (2.3.0). */
  interest_amount?: number | null;
  /** Pago de cuota (con `installment_no`) o desembolso de un préstamo (2.1.0). */
  loan_id?: string | null;
  /** Ocurrencia de un plan recurrente: salario, suscripción o seguro (2.7.0). */
  plan_id?: string | null;
  /** Cuenta destino de una transferencia (2.0.0). */
  to_account_id?: string | null;
  /** "sinpe" en gastos por SINPE Móvil (2.0.0). */
  channel?: "sinpe" | null;
  counterparty_name?: string | null;
  counterparty_phone?: string | null;
  /** Gasto de cuenta pagado con su tarjeta de débito (2.8.0). */
  debit_card_id?: string | null;
  /** Abono en otra moneda (M5, 2.8.0): lo que salió de la cuenta, en su moneda. */
  account_amount?: number | null;
  /** Abono en otra moneda (M5, 2.8.0): colones por dólar usados. */
  exchange_rate?: number | null;
  archived: boolean;
  created_at: string;
};

/** Tarjeta de débito de una cuenta bancaria (2.8.0, C3). */
export type DebitCard = {
  id: string;
  account_id: string;
  name: string;
  last_four: string | null;
  archived: boolean;
  created_at: string;
};

export type Financing = {
  id: string;
  user_id: string;
  card_id: string;
  description: string;
  category: string | null;
  /** Capital financiado; en tasa 0, el total de la compra. */
  total_amount: number;
  /** Tasa anual en porcentaje; 0 = sin interés (2.3.0). */
  annual_rate?: number;
  months: number;
  currency: string;
  first_charge_on: string; // "YYYY-MM-DD"
  /** Fecha en que se eliminó (F4): las cuotas posteriores ya no existen. */
  cancelled_on?: string | null;
  archived: boolean;
  created_at: string;
};

/** Préstamo bancario con interés (2.1.0). El calendario lo deriva el dominio. */
export type Loan = {
  id: string;
  user_id: string;
  name: string;
  lender: string | null;
  principal: number;
  annual_rate: number;
  months: number;
  currency: string;
  first_payment_on: string; // "YYYY-MM-DD"
  account_id: string | null;
  archived: boolean;
  created_at: string;
};

/** Miembro de la familia que paga parte de un financiamiento (2.3.0). */
export type Member = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  /** Con código de país, solo dígitos (p. ej. 50688887777). */
  phone: string | null;
  archived: boolean;
  created_at: string;
};

export type CategoryKind = "expense" | "income";

export type Category = {
  id: string;
  user_id: string;
  kind: CategoryKind;
  name: string;
  /** Clave del ícono (2.5.0, `category-icon-keys.ts`); null = sugerido por el nombre. */
  icon?: string | null;
  archived: boolean;
  created_at: string;
};

export type Bank = {
  id: string;
  user_id: string;
  name: string;
  sender_emails: string[];
  parser_key: string;
  enabled: boolean;
  archived: boolean;
  created_at: string;
};

export type PendingStatus = "pending" | "approved" | "rejected";

export type PendingTransaction = {
  id: string;
  user_id: string;
  bank_id: string | null;
  source_message_id: string;
  merchant: string;
  amount: number;
  currency: string;
  occurred_on: string; // "YYYY-MM-DD"
  last_four: string | null;
  auth_code: string | null;
  reference: string | null;
  card_id: string | null;
  suggested_category: string | null;
  status: PendingStatus;
  transaction_id: string | null;
  archived: boolean;
  created_at: string;
};

export type MailConnection = {
  id: string;
  user_id: string;
  provider: "gmail";
  email: string;
  /** Permisos concedidos al conectar (2.3.0: incluye `gmail.send`). */
  scopes?: string | null;
  last_synced_at: string | null;
  created_at: string;
};
