"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bankSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";

function revalidate() {
  revalidatePath("/ajustes/bancos");
  revalidatePath("/procesos/tarjetas");
}

export async function saveBank(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const id = (formData.get("id") as string) || null;
  const parsed = bankSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("banks").update(parsed.data).eq("id", id)
    : await supabase.from("banks").insert(parsed.data);

  if (error) return { ok: false, message: error.message };

  revalidate();
  return { ok: true };
}

export async function deleteBank(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("banks").delete().eq("id", id);
  revalidate();
}
