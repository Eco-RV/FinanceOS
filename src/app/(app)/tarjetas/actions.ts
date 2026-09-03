"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { creditCardSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";

function revalidate() {
  revalidatePath("/tarjetas");
  revalidatePath("/dashboard");
}

export async function saveCard(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const id = (formData.get("id") as string) || null;
  const parsed = creditCardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const values = parsed.data;

  const { error } = id
    ? await supabase.from("credit_cards").update(values).eq("id", id)
    : await supabase.from("credit_cards").insert(values);

  if (error) return { ok: false, message: error.message };

  revalidate();
  return { ok: true };
}

export async function deleteCard(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("credit_cards").delete().eq("id", id);
  revalidate();
}
