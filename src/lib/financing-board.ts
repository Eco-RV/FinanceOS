import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  memberParts,
  memberReceivables,
  noticeGroups,
  type MemberPart,
  type NoticeGroup,
  type Receivable,
  type Reimbursement,
  type SentNotice,
  type ShareablePlan,
} from "@/domain";
import type { Member } from "@/lib/types";
import type { NoticePlan } from "@/lib/notices";

export type FinancingBoard = {
  members: Map<string, Member>;
  plans: Map<string, NoticePlan & { card_id: string; currency: string }>;
  parts: MemberPart[];
  /** F8: avisos por miembro y fecha límite (dentro de 3 quincenas o vencidos). */
  groups: NoticeGroup[];
  /** Partes de cuotas ya cobradas que el miembro no ha reembolsado. */
  receivables: Receivable[];
};

/**
 * Lee todo lo que hace falta para los avisos y los cobros a miembros (F6–F8)
 * y lo pasa por el dominio. Solo financiamientos activos con reparto.
 */
export async function loadFinancingBoard(
  supabase: SupabaseClient,
  todayISO: string,
  options: { financingId?: string } = {},
): Promise<FinancingBoard> {
  let sharesQuery = supabase
    .from("financing_shares")
    .select("financing_id, member_id, amount")
    .eq("archived", false);
  if (options.financingId) sharesQuery = sharesQuery.eq("financing_id", options.financingId);
  const { data: shareData } = await sharesQuery;
  const shares = (shareData ?? []) as { financing_id: string; member_id: string; amount: number }[];
  const financingIds = [...new Set(shares.map((s) => s.financing_id))];

  const empty: FinancingBoard = {
    members: new Map(),
    plans: new Map(),
    parts: [],
    groups: [],
    receivables: [],
  };
  if (financingIds.length === 0) return empty;

  const [
    { data: finData },
    { data: cuotaData },
    { data: memberData },
    { data: reimbData },
    { data: noticeData },
  ] = await Promise.all([
    supabase
      .from("financings")
      .select("id, card_id, description, months, currency, credit_cards(name, cutoff_day, payment_due_day, archived)")
      .in("id", financingIds)
      .eq("archived", false),
    supabase
      .from("transactions")
      .select("financing_id, installment_no, occurred_on")
      .in("financing_id", financingIds)
      .eq("archived", false),
    supabase.from("members").select("*"),
    supabase
      .from("member_reimbursements")
      .select("id, financing_id, member_id, installment_no, paid_on, amount")
      .in("financing_id", financingIds)
      .eq("archived", false),
    supabase
      .from("member_notices")
      .select("financing_id, member_id, installment_no, quincenas, sent_at")
      .in("financing_id", financingIds)
      .eq("archived", false),
  ]);

  type FinRow = {
    id: string;
    card_id: string;
    description: string;
    months: number;
    currency: string;
    credit_cards: { name: string; cutoff_day: number; payment_due_day: number; archived: boolean } | null;
  };
  const plansById = new Map<string, NoticePlan & { card_id: string; currency: string }>();
  const shareable: ShareablePlan[] = [];
  for (const f of (finData ?? []) as unknown as FinRow[]) {
    const card = f.credit_cards;
    if (!card || card.archived) continue;
    plansById.set(f.id, {
      card_id: f.card_id,
      description: f.description,
      months: Number(f.months),
      currency: f.currency,
      cardName: card.name,
    });
    shareable.push({
      id: f.id,
      currency: f.currency === "USD" ? "USD" : "CRC",
      cycle: { cutoff_day: card.cutoff_day, payment_due_day: card.payment_due_day },
      installments: ((cuotaData ?? []) as { financing_id: string; installment_no: number; occurred_on: string }[])
        .filter((c) => c.financing_id === f.id && c.installment_no != null)
        .map((c) => ({ no: Number(c.installment_no), occurred_on: c.occurred_on }))
        .sort((a, b) => a.no - b.no),
      shares: shares
        .filter((s) => s.financing_id === f.id)
        .map((s) => ({ member_id: s.member_id, amount: Number(s.amount) })),
    });
  }

  const reimbursements = ((reimbData ?? []) as Reimbursement[]).map((r) => ({
    ...r,
    installment_no: Number(r.installment_no),
    amount: Number(r.amount),
  }));
  const sent = ((noticeData ?? []) as SentNotice[]).map((n) => ({
    ...n,
    installment_no: Number(n.installment_no),
    quincenas: Number(n.quincenas),
  }));
  const parts = memberParts(shareable, reimbursements);

  return {
    members: new Map(((memberData ?? []) as Member[]).map((m) => [m.id, m])),
    plans: plansById,
    parts,
    groups: noticeGroups(parts, sent, todayISO),
    receivables: memberReceivables(parts, todayISO),
  };
}
