import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "./crypto.ts";
import { getMessage, listMessageIds, refreshAccessToken } from "./gmail.ts";
import { merchantKey } from "./merchants.ts";
import { getParser } from "./parsers/index.ts";

type Connection = {
  user_id: string;
  refresh_token_enc: string;
  last_synced_at: string | null;
};

type BankRow = {
  id: string;
  sender_emails: string[];
  parser_key: string;
};

type CardRow = {
  id: string;
  last_four: string | null;
  bank_id: string | null;
};

export type SyncResult = {
  found: number;
  imported: number;
  ignored: number;
  alreadyKnown: number;
};

const DAY = 86_400;
const FIRST_SYNC_DAYS = 30;

/** "BAC <a@b.cr>" → "a@b.cr" (minúsculas). */
function senderAddress(from: string): string {
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
}

/**
 * Lee los correos nuevos de los bancos activos del usuario y los deja en
 * `pending_transactions`. Idempotente: releer el mismo correo no duplica.
 * El cliente puede ser el del usuario (RLS) o el admin (cron): todo se filtra
 * por `user_id` de forma explícita.
 */
export async function syncConnection(
  supabase: SupabaseClient,
  conn: Connection,
): Promise<SyncResult> {
  const result: SyncResult = { found: 0, imported: 0, ignored: 0, alreadyKnown: 0 };
  const userId = conn.user_id;

  const { data: bankData } = await supabase
    .from("banks")
    .select("id, sender_emails, parser_key")
    .eq("user_id", userId)
    .eq("enabled", true)
    .eq("archived", false);
  const banks = (bankData ?? []) as BankRow[];

  const senders = banks.flatMap((b) => b.sender_emails);
  if (senders.length === 0) return result;

  const now = Math.floor(Date.now() / 1000);
  const since = conn.last_synced_at
    ? Math.floor(new Date(conn.last_synced_at).getTime() / 1000) - DAY
    : now - FIRST_SYNC_DAYS * DAY;
  const query = `from:(${senders.join(" OR ")}) after:${since}`;

  const accessToken = await refreshAccessToken(decryptToken(conn.refresh_token_enc));
  const ids = await listMessageIds(accessToken, query);
  result.found = ids.length;

  // Solo se descargan los mensajes que todavía no están en la bandeja.
  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("pending_transactions")
      .select("source_message_id")
      .eq("user_id", userId)
      .in("source_message_id", ids.slice(i, i + 100));
    for (const r of data ?? []) known.add(r.source_message_id as string);
  }
  const fresh = ids.filter((id) => !known.has(id));
  result.alreadyKnown = ids.length - fresh.length;

  if (fresh.length > 0) {
    const [{ data: cardData }, { data: ruleData }] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("id, last_four, bank_id")
        .eq("user_id", userId)
        .eq("archived", false),
      supabase
        .from("merchant_rules")
        .select("merchant_key, category")
        .eq("user_id", userId)
        .eq("archived", false),
    ]);
    const cards = (cardData ?? []) as CardRow[];
    const rules = new Map(
      (ruleData ?? []).map((r) => [r.merchant_key as string, r.category as string]),
    );

    const rows = [];
    for (const id of fresh) {
      const msg = await getMessage(accessToken, id);
      const from = senderAddress(msg.from);
      const bank = banks.find((b) =>
        b.sender_emails.some((e) => e.toLowerCase() === from),
      );
      const parsed = bank ? getParser(bank.parser_key)?.(msg) : null;
      if (!bank || !parsed) {
        result.ignored++;
        continue;
      }

      let candidates = cards.filter(
        (c) => parsed.lastFour && c.last_four === parsed.lastFour,
      );
      if (candidates.length > 1) {
        candidates = candidates.filter((c) => c.bank_id === bank.id);
      }

      rows.push({
        user_id: userId,
        bank_id: bank.id,
        source_message_id: id,
        merchant: parsed.merchant,
        amount: parsed.amount,
        currency: parsed.currency,
        occurred_on: parsed.occurredOn,
        last_four: parsed.lastFour,
        auth_code: parsed.authorization,
        reference: parsed.reference,
        card_id: candidates.length === 1 ? candidates[0].id : null,
        suggested_category: rules.get(merchantKey(parsed.merchant)) ?? null,
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("pending_transactions")
        .upsert(rows, {
          onConflict: "user_id,source_message_id",
          ignoreDuplicates: true,
        });
      if (error) throw new Error(`No se pudo guardar la bandeja: ${error.message}`);
      result.imported = rows.length;
    }
  }

  await supabase
    .from("mail_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", userId);

  return result;
}
