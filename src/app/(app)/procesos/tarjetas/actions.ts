"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { creditCardSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import {
  removeFromCatalog,
  saveCard as saveCardUseCase,
  setCatalogActive,
  setMinimumPayment,
} from "@/application";
import { z } from "zod";
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

const minimumSchema = z.object({
  card_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, "Tarjeta inválida"),
  cutoff_on: z.string().regex(/^d{4}-d{2}-d{2}$/, "Fecha inválida"),
  currency: z.enum(["CRC", "USD"]),
  amount: z.coerce.number().finite("Monto inválido").min(0, "No puede ser negativo"),
  statement_balance: z.coerce.number().finite(),
});

/** T8 (3.1.0): pago mínimo del corte vigente (0 o vacío lo borra). */
export async function saveMinimumPayment(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const parsed = minimumSchema.safeParse({ ...Object.fromEntries(formData), amount: formData.get("amount") || 0 });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { statement_balance, ...m } = parsed.data;
  const result = await setMinimumPayment(await repositories(), { ...m, statementBalance: statement_balance });
  if (result.ok) revalidate(m.card_id);
  return toFormResult(result);
}
