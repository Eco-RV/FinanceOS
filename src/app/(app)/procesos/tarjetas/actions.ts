"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { creditCardSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import {
  removeFromCatalog,
  saveCard as saveCardUseCase,
  setCatalogActive,
} from "@/application";
import { lifecycleForm, toFormResult } from "@/lib/catalog-actions";
import { repositories } from "@/infrastructure/container";

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

  // Sin selector de banco en el formulario (aún no hay bancos) no se toca la
  // columna: así guardar una tarjeta sigue funcionando antes de la migración 1.3.0.
  const { bank_id, opening_crc, opening_usd, opening_date, ...rest } = parsed.data;
  const fields = formData.has("bank_id") ? { ...rest, bank_id } : rest;

  const result = await saveCardUseCase(await repositories(), {
    id,
    fields,
    openings: [
      { currency: "CRC", amount: opening_crc, occurred_on: opening_date },
      { currency: "USD", amount: opening_usd, occurred_on: opening_date },
    ],
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidate(result.value.id);
  return { ok: true };
}

/** G5: solo se elimina una tarjeta sin movimientos ni financiamientos. */
export async function deleteCard(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta la tarjeta" };

  const { cards } = await repositories();
  const result = await removeFromCatalog(cards, "card", id);
  if (result.ok) revalidate(id);
  return toFormResult(result);
}

/** Desactiva o reactiva una tarjeta; conserva sus movimientos y su saldo. */
export async function setCardActive(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id, active } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta la tarjeta" };

  const { cards } = await repositories();
  const result = await setCatalogActive(cards, "card", id, active);
  if (result.ok) revalidate(id);
  return toFormResult(result);
}
