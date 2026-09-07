"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { accountSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";

function revalidate() {
  revalidatePath("/procesos/cuentas");
  revalidatePath("/procesos");
  revalidatePath("/dashboard");
}

export async function saveAccount(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const id = (formData.get("id") as string) || null;
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const values = parsed.data;

  const { error } = id
    ? await supabase.from("accounts").update(values).eq("id", id)
    : await supabase.from("accounts").insert(values);

  if (error) return { ok: false, message: error.message };

  revalidate();
  return { ok: true };
}

export async function deleteAccount(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("accounts").delete().eq("id", id);
  revalidate();
}
