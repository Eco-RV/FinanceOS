import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptToken } from "./crypto.ts";
import { merchantKey } from "../../domain/importing/merchant.ts";
import { getParser } from "./parsers/index.ts";
import { openProvider, syncErrorMessage } from "./provider.ts";

type Connection = {
  user_id: string;
  provider?: string | null;
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
  /** 3.3.0: aceptadas solas después de leer (lo llena `syncNow`). */
  autoApproved?: number;
};

const DAY = 86_400;
const FIRST_SYNC_DAYS = 30;

/** "BAC <a@b.cr>" → "a@b.cr" (minúsculas). */
function senderAddress(from: string): string {
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
}

/**
 * Un correo del banco que el formato no entendió solo cuenta como alerta si
 * parece un aviso de transacción: los estados de cuenta o promociones del
 * mismo remitente no deben avisar de un cambio de plantilla.
 */
function isPurchaseLike(subject: string): boolean {
  return /transacci|compra|notificaci/i.test(
    subject.normalize("NFD").replace(/[̀-ͯ]/g, ""),
  );
}

/**
 * Lee el buzón y guarda el resultado (o el error) en la conexión, para que
 * Ajustes → Bancos muestre cómo fue la última lectura (3.3.0).
 */
export async function syncConnection(
  supabase: SupabaseClient,
  conn: Connection,
): Promise<SyncResult> {
  try {
    return await readMailbox(supabase, conn);
  } catch (e) {
    const message = syncErrorMessage(e);
    await supabase
      .from("mail_connections")
      .update({ last_error: message, last_error_at: new Date().toISOString() })
      .eq("user_id", conn.user_id);
    throw new Error(message);
  }
}

/** Guarda el resultado de la última lectura (p. ej. con lo aceptado solo). */
export async function recordSyncResult(
  supabase: SupabaseClient,
  userId: string,
  result: SyncResult,
): Promise<void> {
  await supabase.from("mail_connections").update({ last_result: result }).eq("user_id", userId);
}

/**
 * Lee los correos nuevos de los bancos activos del usuario y los deja en
 * `pending_transactions`. Idempotente: releer el mismo correo no duplica.
 * El cliente puede ser el del usuario (RLS) o el admin (cron): todo se filtra
 * por `user_id` de forma explícita.
 */
async function readMailbox(
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

  const provider = await openProvider(conn);
  if (provider.rotatedRefreshToken) {
    await supabase
      .from("mail_connections")
      .update({ refresh_token_enc: encryptToken(provider.rotatedRefreshToken) })
      .eq("user_id", userId);
  }
  const ids = await provider.listMessageIds(senders, since);
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
    // Por banco: cuándo entendió un aviso y cuándo no (¿cambió la plantilla?).
    const parsedBanks = new Set<string>();
    const ignoredBanks = new Set<string>();
    for (const id of fresh) {
      const msg = await provider.getMessage(id);
      const from = senderAddress(msg.from);
      const bank = banks.find((b) =>
        b.sender_emails.some((e) => e.toLowerCase() === from),
      );
      const parsed = bank ? getParser(bank.parser_key)?.(msg) : null;
      if (!bank || !parsed) {
        result.ignored++;
        if (bank && isPurchaseLike(msg.subject)) ignoredBanks.add(bank.id);
        continue;
      }
      parsedBanks.add(bank.id);

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

    const stamp = new Date().toISOString();
    if (parsedBanks.size > 0) {
      await supabase.from("banks").update({ last_parsed_at: stamp }).in("id", [...parsedBanks]);
    }
    if (ignoredBanks.size > 0) {
      await supabase.from("banks").update({ last_ignored_at: stamp }).in("id", [...ignoredBanks]);
    }
  }

  const last_synced_at = new Date().toISOString();
  const { error } = await supabase
    .from("mail_connections")
    .update({ last_synced_at, last_result: result, last_error: null, last_error_at: null })
    .eq("user_id", userId);
  // Sin el SQL 3.3.0 no existen las columnas del resultado: al menos avanzar la fecha.
  if (error) {
    await supabase.from("mail_connections").update({ last_synced_at }).eq("user_id", userId);
  }

  return result;
}
