import type { Transaction, Account, CreditCard } from "@/lib/types";

export const TRANSACTION_TYPE_LABELS = {
  expense: "Gasto",
  income: "Ingreso",
  card_payment: "Pago de tarjeta",
} as const;

/** "account:<id>" | "card:<id>" -> partes. */
export function parseOrigin(token: string): {
  kind: "account" | "card";
  id: string;
} {
  const [kind, id] = token.split(":");
  return { kind: kind as "account" | "card", id };
}

/** Token para el <select> de origen a partir de un movimiento existente. */
export function originValue(t: Pick<Transaction, "account_id" | "card_id">): string {
  if (t.card_id && !t.account_id) return `card:${t.card_id}`;
  if (t.account_id) return `account:${t.account_id}`;
  return "";
}

/** Etiqueta legible del origen de una fila (para tablas). */
export function originLabel(
  t: Transaction,
  accounts: Account[],
  cards: CreditCard[],
): string {
  if (t.account_id) {
    const a = accounts.find((x) => x.id === t.account_id);
    if (a) return a.name;
  }
  if (t.card_id) {
    const c = cards.find((x) => x.id === t.card_id);
    if (c) return c.name;
  }
  return "—";
}
