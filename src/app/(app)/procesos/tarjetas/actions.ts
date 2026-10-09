"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { creditCardSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";

function revalidate(id?: string) {
  revalidatePath("/procesos/tarjetas");
  revalidatePath("/procesos");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/procesos/tarjetas/${id}`);
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
  // Sin selector de banco en el formulario (aún no hay bancos) no se toca la
  // columna: así guardar una tarjeta sigue funcionando antes de la migración 1.3.0.
  const { bank_id, ...rest } = parsed.data;
  const values = formData.has("bank_id") ? { ...rest, bank_id } : rest;

  const { error } = id
    ? await supabase.from("credit_cards").update(values).eq("id", id)
    : await supabase.from("credit_cards").insert(values);

  if (error) return { ok: false, message: error.message };

  revalidate(id ?? undefined);
  return { ok: true };
}

export async function deleteCard(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("credit_cards").delete().eq("id", id);
  revalidate(id);
}
