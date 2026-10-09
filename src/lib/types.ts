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
  current_balance: number;
  currency: string;
  archived: boolean;
  created_at: string;
};

export type TransactionType = "expense" | "income" | "card_payment";

export type Transaction = {
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
  archived: boolean;
  created_at: string;
};

export type Financing = {
  id: string;
  user_id: string;
  card_id: string;
  description: string;
  category: string | null;
  total_amount: number;
  months: number;
  currency: string;
  first_charge_on: string; // "YYYY-MM-DD"
  archived: boolean;
  created_at: string;
};

export type CategoryKind = "expense" | "income";

export type Category = {
  id: string;
  user_id: string;
  kind: CategoryKind;
  name: string;
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
  last_synced_at: string | null;
  created_at: string;
};
