"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import { parseOrigin } from "@/lib/transactions";
import { DomainError, isCurrency, validateMovement, type Currency } from "@/domain";

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

  const currencyOf = async (table: "accounts" | "credit_cards", rowId: string | null) => {
    if (!rowId) return null;
    const { data } = await supabase.from(table).select("currency").eq("id", rowId).single();
    return data && isCurrency(data.currency) ? data.currency : null;
  };

  // Reglas de dominio: categoría obligatoria, abono cuenta→tarjeta en la misma
  // moneda (M1/M3/M5). La moneda del movimiento es la del origen.
  let currency: Currency;
  try {
    currency = validateMovement({
      type,
      amount,
      category,
      accountCurrency: await currencyOf("accounts", account_id),
      cardCurrency: await currencyOf("credit_cards", resolvedCardId),
    });
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, message: e.message };
    throw e;
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
