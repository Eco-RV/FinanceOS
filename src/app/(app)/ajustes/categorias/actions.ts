"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  categorySchema,
  CATEGORY_KINDS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import type { CategoryKind } from "@/lib/types";
import {
  removeFromCatalog,
  saveCategory as saveCategoryUseCase,
  seedCategories as seedCategoriesUseCase,
  setCatalogActive,
} from "@/application";
import { repositories } from "@/infrastructure/container";
import { lifecycleForm, toFormResult } from "@/lib/catalog-actions";

function revalidate() {
  revalidatePath("/ajustes/categorias");
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/ingresos");
}

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

  const { categories } = await repositories();
  const result = await saveCategoryUseCase(categories, { id, fields: parsed.data });
  if (result.ok) revalidate();
  return toFormResult(result);
}

/** G5: solo se elimina una categoría que ningún movimiento usa. */
export async function deleteCategory(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta la categoría" };

  const { categories } = await repositories();
  const result = await removeFromCatalog(categories, "category", id);
  if (result.ok) revalidate();
  return toFormResult(result);
}

/** Desactiva (deja de ofrecerse) o reactiva una categoría. */
export async function setCategoryActive(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id, active } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta la categoría" };

  const { categories } = await repositories();
  const result = await setCatalogActive(categories, "category", id, active);
  if (result.ok) revalidate();
  return toFormResult(result);
}

export async function seedCategories(formData: FormData) {
  await requireUser();
  const kind = formData.get("kind") as CategoryKind;
  if (!CATEGORY_KINDS.includes(kind)) return;

  const { categories } = await repositories();
  const suggested = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  await seedCategoriesUseCase(categories, kind, suggested);
  revalidate();
}
