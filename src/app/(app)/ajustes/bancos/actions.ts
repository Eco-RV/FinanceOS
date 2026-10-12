"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { bankSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import {
  removeFromCatalog,
  saveBank as saveBankUseCase,
  setCatalogActive,
} from "@/application";
import { repositories } from "@/infrastructure/container";
import { lifecycleForm, toFormResult } from "@/lib/catalog-actions";

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

  const { banks } = await repositories();
  const result = await saveBankUseCase(banks, { id, fields: parsed.data });
  if (result.ok) revalidate();
  return toFormResult(result);
}

/** G5: solo se elimina un banco sin avisos importados. */
export async function deleteBank(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta el banco" };

  const { banks } = await repositories();
  const result = await removeFromCatalog(banks, "bank", id);
  if (result.ok) revalidate();
  return toFormResult(result);
}

/** Desactiva (deja de leer sus correos) o reactiva un banco. */
export async function setBankActive(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id, active } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta el banco" };

  const { banks } = await repositories();
  const result = await setCatalogActive(banks, "bank", id, active);
  if (result.ok) revalidate();
  return toFormResult(result);
}
