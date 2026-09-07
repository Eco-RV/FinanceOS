"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import { parseOrigin } from "@/lib/transactions";

function revalidateTx(cardIds: (string | null | undefined)[] = []) {
  revalidatePath("/dashboard");
  revalidatePath("/procesos");
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/ingresos");
  revalidatePath("/procesos/cuentas");
  revalidatePath("/procesos/tarjetas");
  for (const id of cardIds) {
    if (id) revalidatePath(`/procesos/tarjetas/${id}`);
  }
}

export async function saveTransaction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const id = (formData.get("id") as string) || null;
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const { origin, card_id, type, amount, occurred_on, category, note } =
    parsed.data;
  const { kind, id: originId } = parseOrigin(origin);

  const account_id = kind === "account" ? originId : null;
  const resolvedCardId =
    type === "card_payment" ? card_id : kind === "card" ? originId : null;

  const supabase = await createClient();

  // La moneda del movimiento se copia de la cuenta/tarjeta elegida.
  let currency = "CRC";
  if (account_id) {
    const { data } = await supabase
      .from("accounts")
      .select("currency")
      .eq("id", account_id)
      .single();
    currency = data?.currency ?? "CRC";
  } else if (resolvedCardId) {
    const { data } = await supabase
      .from("credit_cards")
      .select("currency")
      .eq("id", resolvedCardId)
      .single();
    currency = data?.currency ?? "CRC";
  }

  // card_payment: cuenta y tarjeta deben coincidir en moneda (no hay conversión).
  if (type === "card_payment" && account_id && resolvedCardId) {
    const { data: card } = await supabase
      .from("credit_cards")
      .select("currency")
      .eq("id", resolvedCardId)
      .single();
    if (card && card.currency !== currency) {
      return {
        ok: false,
        message: "La cuenta y la tarjeta deben usar la misma moneda",
      };
    }
  }

  const values = {
    type,
    amount,
    occurred_on,
    category,
    note,
    currency,
    account_id,
    card_id: resolvedCardId,
  };

  // Si es edición, guardamos la tarjeta anterior para revalidar su detalle.
  let prevCardId: string | null = null;
  if (id) {
    const { data } = await supabase
      .from("transactions")
      .select("card_id")
      .eq("id", id)
      .single();
    prevCardId = data?.card_id ?? null;
  }

  const { error } = id
    ? await supabase.from("transactions").update(values).eq("id", id)
    : await supabase.from("transactions").insert(values);

  if (error) return { ok: false, message: error.message };

  revalidateTx([resolvedCardId, prevCardId]);
  return { ok: true };
}

export async function deleteTransaction(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("card_id")
    .eq("id", id)
    .single();
  await supabase.from("transactions").delete().eq("id", id);
  revalidateTx([data?.card_id]);
}
