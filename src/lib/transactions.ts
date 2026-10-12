import type { Transaction, Account, CreditCard, OpeningBalance } from "@/lib/types";

export const TRANSACTION_TYPE_LABELS = {
  expense: "Gasto",
  income: "Ingreso",
  card_payment: "Pago de tarjeta",
  opening_balance: "Saldo inicial",
  transfer: "Transferencia",
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

/** Nombre para mostrar; marca lo desactivado (G5) para que se entienda en el historial. */
export function productLabel(p: Pick<Account, "name" | "archived"> | undefined): string {
  if (!p) return "—";
  return p.archived ? `${p.name} (desactivada)` : p.name;
}

/**
 * Etiqueta legible del origen de una fila (para tablas). Recibe también las
 * cuentas/tarjetas desactivadas para no perder el nombre en el historial.
 */
export function originLabel(
  t: Transaction,
  accounts: Account[],
  cards: CreditCard[],
): string {
  if (t.account_id) {
    const a = accounts.find((x) => x.id === t.account_id);
    if (a) return productLabel(a);
  }
  if (t.card_id) {
    const c = cards.find((x) => x.id === t.card_id);
    if (c) return productLabel(c);
  }
  return "—";
}

/**
 * G4: un movimiento ligado a una cuenta o tarjeta desactivada no se edita ni
 * se elimina desde los listados; primero hay que activarla.
 */
export function touchesInactive(
  t: Pick<Transaction, "account_id" | "card_id" | "to_account_id">,
  accounts: Pick<Account, "id" | "archived">[],
  cards: Pick<CreditCard, "id" | "archived">[],
): boolean {
  const inactive = (list: { id: string; archived: boolean }[], id: string | null | undefined) =>
    Boolean(id) && list.some((x) => x.id === id && x.archived);
  return (
    inactive(accounts, t.account_id) ||
    inactive(accounts, t.to_account_id) ||
    inactive(cards, t.card_id)
  );
}

type OpeningRow = {
  account_id: string | null;
  card_id: string | null;
  amount: number;
  occurred_on: string;
};

/** Saldos iniciales indexados por id de cuenta o tarjeta. */
export function openingsById(rows: OpeningRow[] | null | undefined): Map<string, OpeningBalance> {
  const map = new Map<string, OpeningBalance>();
  for (const r of rows ?? []) {
    const id = r.account_id ?? r.card_id;
    if (id) map.set(id, { amount: Number(r.amount), occurred_on: r.occurred_on });
  }
  return map;
}

/** Saldos iniciales de tarjetas por moneda (T1: puede haber uno en CRC y otro en USD). */
export function cardOpeningsById(
  rows: (OpeningRow & { currency: string })[] | null | undefined,
): Map<string, Partial<Record<string, OpeningBalance>>> {
  const map = new Map<string, Partial<Record<string, OpeningBalance>>>();
  for (const r of rows ?? []) {
    if (!r.card_id) continue;
    const byCurrency = map.get(r.card_id) ?? {};
    byCurrency[r.currency] = { amount: Number(r.amount), occurred_on: r.occurred_on };
    map.set(r.card_id, byCurrency);
  }
  return map;
}
