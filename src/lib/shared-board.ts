import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sharedNoticeGroups,
  sharedReceivables,
  type SharedNoticeGroup,
  type SharedPart,
  type SharedPaymentChannel,
  type SharedReceivable,
  type SharedSentNotice,
} from "@/domain";
import type { Member } from "@/lib/types";

/** Un gasto compartido con lo que hace falta para listarlo y avisar. */
export type SharedExpenseView = {
  id: string;
  transaction_id: string;
  description: string;
  currency: "CRC" | "USD";
  total_amount: number;
  occurred_on: string;
  due_on: string;
  card_id: string | null;
  account_id: string | null;
  category: string | null;
  /** Parte del usuario (X2: el resto). */
  own: number;
  parts: (SharedPart & {
    channel: SharedPaymentChannel | null;
    note: string | null;
    income_transaction_id: string | null;
  })[];
};

export type SharedBoard = {
  members: Map<string, Member>;
  expenses: Map<string, SharedExpenseView>;
  parts: SharedPart[];
  /** X5: avisos por persona, fecha límite y moneda. */
  groups: SharedNoticeGroup[];
  /** Partes de gastos ya ocurridos que la persona no ha pagado. */
  receivables: SharedReceivable[];
  /** Movimiento → gasto compartido (el gasto o el ingreso de un cobro). */
  links: Map<string, string>;
};

const EMPTY: SharedBoard = {
  members: new Map(),
  expenses: new Map(),
  parts: [],
  groups: [],
  receivables: [],
  links: new Map(),
};

/**
 * Lee los gastos compartidos activos y los pasa por el dominio (X2–X5). Sin el
 * SQL 3.1.0 devuelve todo vacío.
 */
export async function loadSharedBoard(
  supabase: SupabaseClient,
  todayISO: string,
  options: { id?: string } = {},
): Promise<SharedBoard> {
  let query = supabase
    .from("shared_expenses")
    .select(
      "id, transaction_id, description, currency, total_amount, due_on, created_at, transactions(occurred_on, card_id, account_id, category, archived), shared_expense_parts(member_id, amount, paid_on, channel, note, income_transaction_id, archived)",
    )
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (options.id) query = query.eq("id", options.id);
  const { data, error } = await query;
  if (error || !data || data.length === 0) return EMPTY;

  const expenses = new Map<string, SharedExpenseView>();
  const links = new Map<string, string>();
  for (const row of data as Record<string, unknown>[]) {
    const tx = row.transactions as {
      occurred_on: string;
      card_id: string | null;
      account_id: string | null;
      category: string | null;
      archived: boolean;
    } | null;
    if (!tx || tx.archived) continue;
    const id = row.id as string;
    const currency = row.currency === "USD" ? "USD" : "CRC";
    const due_on = row.due_on as string;
    const parts = ((row.shared_expense_parts as Record<string, unknown>[] | null) ?? [])
      .filter((p) => !p.archived)
      .map((p) => ({
        shared_expense_id: id,
        member_id: p.member_id as string,
        amount: Number(p.amount),
        currency: currency as "CRC" | "USD",
        occurred_on: tx.occurred_on,
        due_on,
        paid_on: (p.paid_on as string | null) ?? null,
        channel: (p.channel as SharedPaymentChannel | null) ?? null,
        note: (p.note as string | null) ?? null,
        income_transaction_id: (p.income_transaction_id as string | null) ?? null,
      }));
    const total = Number(row.total_amount);
    const membersCents = parts.reduce((s, p) => s + Math.round(p.amount * 100), 0);
    expenses.set(id, {
      id,
      transaction_id: row.transaction_id as string,
      description: row.description as string,
      currency,
      total_amount: total,
      occurred_on: tx.occurred_on,
      due_on,
      card_id: tx.card_id,
      account_id: tx.account_id,
      category: tx.category,
      own: (Math.round(total * 100) - membersCents) / 100,
      parts,
    });
    links.set(row.transaction_id as string, id);
    for (const p of parts) if (p.income_transaction_id) links.set(p.income_transaction_id, id);
  }

  const ids = [...expenses.keys()];
  const memberIds = [...new Set([...expenses.values()].flatMap((e) => e.parts.map((p) => p.member_id)))];
  const [{ data: memberData }, { data: noticeData }] = await Promise.all([
    memberIds.length
      ? supabase.from("members").select("*").in("id", memberIds)
      : Promise.resolve({ data: [] as Member[] }),
    ids.length
      ? supabase
          .from("shared_expense_notices")
          .select("shared_expense_id, member_id, quincenas, sent_at")
          .eq("archived", false)
          .in("shared_expense_id", ids)
      : Promise.resolve({ data: [] as SharedSentNotice[] }),
  ]);

  const parts = [...expenses.values()].flatMap((e) => e.parts);
  return {
    members: new Map(((memberData ?? []) as Member[]).map((m) => [m.id, m])),
    expenses,
    parts,
    groups: sharedNoticeGroups(parts, (noticeData ?? []) as SharedSentNotice[], todayISO),
    receivables: sharedReceivables(parts, todayISO),
    links,
  };
}

/** Solo los vínculos movimiento → compartido (para las listas de movimientos). */
export async function loadSharedLinks(supabase: SupabaseClient): Promise<Record<string, string>> {
  const [{ data: exp, error }, { data: inc }] = await Promise.all([
    supabase.from("shared_expenses").select("id, transaction_id").eq("archived", false),
    supabase
      .from("shared_expense_parts")
      .select("shared_expense_id, income_transaction_id")
      .not("income_transaction_id", "is", null),
  ]);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const r of exp ?? []) out[r.transaction_id as string] = r.id as string;
  for (const r of inc ?? []) out[r.income_transaction_id as string] = r.shared_expense_id as string;
  return out;
}
