"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createFinancing as createFinancingUseCase,
  deleteFinancing as deleteFinancingUseCase,
} from "@/application";
import { repositories } from "@/infrastructure/container";
import { financingSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";

function revalidateFinancing(cardId: string | null | undefined) {
  revalidatePath("/dashboard");
  revalidatePath("/procesos/tarjetas");
  if (cardId) revalidatePath(`/procesos/tarjetas/${cardId}`);
}

export async function createFinancing(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const parsed = financingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const result = await createFinancingUseCase(await repositories(), parsed.data);
  if (!result.ok) return { ok: false, message: result.message };

  revalidateFinancing(parsed.data.card_id);
  return { ok: true };
}

export async function deleteFinancing(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const result = await deleteFinancingUseCase(await repositories(), id);
  if (result.ok) revalidateFinancing(result.value.cardId);
}
