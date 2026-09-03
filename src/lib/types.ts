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
  credit_limit: number | null;
  cutoff_day: number;
  payment_due_day: number;
  current_balance: number;
  currency: string;
  archived: boolean;
  created_at: string;
};
