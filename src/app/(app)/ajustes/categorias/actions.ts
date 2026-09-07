"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  CATEGORY_KINDS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import type { CategoryKind } from "@/lib/types";

function revalidate() {
  revalidatePath("/ajustes/categorias");
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/ingresos");
}

const DUP = "Ya existe esa categoría";

export async function saveCategory(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const id = (formData.get("id") as string) || null;
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("categories").update(parsed.data).eq("id", id)
    : await supabase.from("categories").insert(parsed.data);

  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? DUP : error.message,
    };
  }

  revalidate();
  return { ok: true };
}

export async function deleteCategory(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("categories").delete().eq("id", id);
  revalidate();
}

export async function seedCategories(formData: FormData) {
  await requireUser();
  const kind = formData.get("kind") as CategoryKind;
  if (!CATEGORY_KINDS.includes(kind)) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("categories")
    .select("name")
    .eq("kind", kind);

  const have = new Set(
    (existing ?? []).map((c) => c.name.trim().toLowerCase()),
  );
  const suggested = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const rows = suggested
    .filter((name) => !have.has(name.toLowerCase()))
    .map((name) => ({ kind, name }));

  if (rows.length > 0) {
    await supabase.from("categories").insert(rows);
  }
  revalidate();
}
