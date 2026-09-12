"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { financingSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";

function revalidateFinancing(cardId: string | null | undefined) {
  revalidatePath("/dashboard");
  revalidatePath("/procesos/tarjetas");
  if (cardId) revalidatePath(`/procesos/tarjetas/${cardId}`);
}

export async function createFinancing(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const parsed = financingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const { card_id, description, category, total_amount, months, first_charge_on } =
    parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_financing", {
    p_card_id: card_id,
    p_description: description,
    p_category: category,
    p_total_amount: total_amount,
    p_months: months,
    p_first_charge_on: first_charge_on,
  });

  if (error) return { ok: false, message: "No se pudo crear el financiamiento." };

  revalidateFinancing(card_id);
  return { ok: true };
}

export async function deleteFinancing(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("financings")
    .select("card_id")
    .eq("id", id)
    .single();

  await supabase.from("financings").delete().eq("id", id);
  revalidateFinancing(data?.card_id);
}
