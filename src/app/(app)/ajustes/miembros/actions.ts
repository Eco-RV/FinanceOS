"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { memberSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import {
  removeFromCatalog,
  saveMember as saveMemberUseCase,
  setCatalogActive,
} from "@/application";
import { repositories } from "@/infrastructure/container";
import { lifecycleForm, toFormResult } from "@/lib/catalog-actions";

function revalidate() {
  revalidatePath("/ajustes/miembros");
  revalidatePath("/procesos/cobros");
  revalidatePath("/procesos/tarjetas", "layout");
}

export async function saveMember(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const id = (formData.get("id") as string) || null;
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const result = await saveMemberUseCase((await repositories()).members, {
    id,
    fields: parsed.data,
  });
  if (result.ok) revalidate();
  return toFormResult(result);
}

/** G5: solo se elimina un miembro sin partes ni reembolsos. */
export async function deleteMember(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta el miembro" };
  const result = await removeFromCatalog((await repositories()).members, "member", id);
  if (result.ok) revalidate();
  return toFormResult(result);
}

export async function setMemberActive(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id, active } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta el miembro" };
  const result = await setCatalogActive((await repositories()).members, "member", id, active);
  if (result.ok) revalidate();
  return toFormResult(result);
}
