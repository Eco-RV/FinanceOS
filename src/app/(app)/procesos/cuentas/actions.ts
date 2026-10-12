"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { accountSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import {
  removeFromCatalog,
  saveAccount as saveAccountUseCase,
  setCatalogActive,
} from "@/application";
import { lifecycleForm, toFormResult } from "@/lib/catalog-actions";
import { repositories } from "@/infrastructure/container";

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

  const { opening_amount, opening_date, ...fields } = parsed.data;
  const result = await saveAccountUseCase(await repositories(), {
    id,
    fields,
    opening: { amount: opening_amount, occurred_on: opening_date },
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidate();
  return { ok: true };
}

/** G5: solo se elimina una cuenta sin movimientos. */
export async function deleteAccount(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta la cuenta" };

  const { accounts } = await repositories();
  const result = await removeFromCatalog(accounts, "account", id);
  if (result.ok) revalidate();
  return toFormResult(result);
}

/** Desactiva o reactiva una cuenta; conserva sus movimientos y su saldo. */
export async function setAccountActive(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id, active } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta la cuenta" };

  const { accounts } = await repositories();
  const result = await setCatalogActive(accounts, "account", id, active);
  if (result.ok) revalidate();
  return toFormResult(result);
}
