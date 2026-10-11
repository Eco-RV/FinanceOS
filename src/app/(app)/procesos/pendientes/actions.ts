"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { merchantKey } from "@/lib/mail/merchants";
import { syncConnection } from "@/lib/mail/sync";
import type { PendingTransaction } from "@/lib/types";
import { assertSameCurrency, isCurrency } from "@/domain";

const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/);

const approveSchema = z.object({
  id: uuid,
  card_id: uuid,
  category: z.string().trim().min(1).max(40),
});

function revalidate(cardId?: string | null) {
  revalidatePath("/procesos/pendientes");
  revalidatePath("/procesos");
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/tarjetas");
  revalidatePath("/dashboard");
  if (cardId) revalidatePath(`/procesos/tarjetas/${cardId}`);
}

/**
 * Confirma un pendiente: crea el gasto en la tarjeta (el trigger de Postgres
 * ajusta el saldo) y aprende comercio → categoría para la próxima vez.
 */
export async function approvePending(formData: FormData) {
  await requireUser();
  const parsed = approveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { id, card_id, category } = parsed.data;

  const supabase = await createClient();
  const { data: pendingData } = await supabase
    .from("pending_transactions")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  const pending = pendingData as PendingTransaction | null;
  if (!pending) return;

  // I5: sin conversión de moneda, la compra debe ser en la moneda de la tarjeta.
  const { data: card } = await supabase
    .from("credit_cards")
    .select("currency")
    .eq("id", card_id)
    .maybeSingle();
  if (!card || !isCurrency(card.currency) || !isCurrency(pending.currency)) return;
  try {
    assertSameCurrency(pending.currency, card.currency, "I5");
  } catch {
    return;
  }

  const { data: tx, error } = await supabase
    .from("transactions")
    .insert({
      type: "expense",
      amount: pending.amount,
      occurred_on: pending.occurred_on,
      category,
      note: pending.merchant.slice(0, 200),
      currency: pending.currency,
      account_id: null,
      card_id,
    })
    .select("id")
    .single();
  if (error || !tx) return;

  await supabase
    .from("pending_transactions")
    .update({ status: "approved", transaction_id: tx.id, card_id })
    .eq("id", id);

  const key = merchantKey(pending.merchant);
  const { data: rule } = await supabase
    .from("merchant_rules")
    .select("id")
    .eq("merchant_key", key)
    .eq("archived", false)
    .maybeSingle();
  if (rule) {
    await supabase.from("merchant_rules").update({ category }).eq("id", rule.id);
  } else {
    await supabase.from("merchant_rules").insert({ merchant_key: key, category });
  }

  revalidate(card_id);
}

export async function rejectPending(formData: FormData) {
  await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase
    .from("pending_transactions")
    .update({ status: "rejected" })
    .eq("id", id.data)
    .eq("status", "pending");
  revalidate();
}

export type SyncNowResult =
  | { ok: true; imported: number; found: number }
  | { ok: false; message: string };

/** "Sincronizar ahora": mismo proceso que el cron, con la sesión del usuario. */
export async function syncNow(): Promise<SyncNowResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: conn } = await supabase
    .from("mail_connections")
    .select("user_id, refresh_token_enc, last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conn) return { ok: false, message: "Conectá tu correo en Ajustes → Bancos" };

  try {
    const r = await syncConnection(supabase, conn);
    revalidate();
    return { ok: true, imported: r.imported, found: r.found };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "No se pudo sincronizar",
    };
  }
}
