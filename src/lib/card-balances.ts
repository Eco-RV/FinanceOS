import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCurrency, scheduledInterest, type Currency } from "@/domain";

export type InterestByCurrency = Partial<Record<Currency, number>>;

/**
 * Interés de cuotas de financiamientos que todavía no llegan, por tarjeta y
 * moneda. El saldo guardado (`current_balance` / `usd_balance`) incluye el
 * plan completo; solo el capital debe contar desde el día 1 (F5).
 */
export async function scheduledInterestByCard(
  supabase: SupabaseClient,
  todayISO: string,
): Promise<Map<string, InterestByCurrency>> {
  const { data } = await supabase
    .from("transactions")
    .select("card_id, currency, occurred_on, interest_amount")
    .eq("archived", false)
    .not("interest_amount", "is", null)
    .not("card_id", "is", null)
    .gt("occurred_on", todayISO);

  return interestByCard(data ?? [], todayISO);
}

/** Igual que `scheduledInterestByCard`, a partir de movimientos ya leídos. */
export function interestByCard(
  txns: { card_id: string | null; currency: string; occurred_on: string; interest_amount?: number | null }[],
  todayISO: string,
): Map<string, InterestByCurrency> {
  const byCard = new Map<string, { occurred_on: string; interest_amount: number; currency: Currency }[]>();
  for (const t of txns) {
    if (!t.card_id || t.interest_amount == null) continue;
    const list = byCard.get(t.card_id) ?? [];
    list.push({
      occurred_on: t.occurred_on,
      interest_amount: Number(t.interest_amount),
      currency: isCurrency(String(t.currency)) ? (t.currency as Currency) : "CRC",
    });
    byCard.set(t.card_id, list);
  }
  return new Map([...byCard].map(([id, list]) => [id, scheduledInterest(list, todayISO)]));
}

/** La tarjeta con su deuda de hoy: sin el interés de cuotas programadas. */
export function withoutScheduledInterest<
  T extends { id: string; current_balance: number; usd_balance?: number | null },
>(card: T, interest: Map<string, InterestByCurrency>): T {
  const i = interest.get(card.id);
  if (!i) return card;
  return {
    ...card,
    current_balance: Number(card.current_balance) - (i.CRC ?? 0),
    usd_balance: Number(card.usd_balance ?? 0) - (i.USD ?? 0),
  };
}
