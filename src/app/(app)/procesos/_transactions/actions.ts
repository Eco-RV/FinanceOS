"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { transactionSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import { parseOrigin } from "@/lib/transactions";
import { deleteMovement, saveMovement } from "@/application";
import { repositories } from "@/infrastructure/container";

function revalidateTx(cardIds: string[] = []) {
  revalidatePath("/dashboard");
  revalidatePath("/procesos");
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/ingresos");
  revalidatePath("/procesos/cuentas");
  revalidatePath("/procesos/tarjetas");
  for (const id of cardIds) {
    if (id) revalidatePath(`/procesos/tarjetas/${id}`);
  }
}

export async function saveTransaction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const id = (formData.get("id") as string) || null;
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const { origin, card_id, type, amount, occurred_on, category, note } =
    parsed.data;
  const { kind, id: originId } = parseOrigin(origin);

  const result = await saveMovement(await repositories(), {
    id,
    type,
    amount,
    occurred_on,
    category,
    note,
    account_id: kind === "account" ? originId : null,
    card_id: type === "card_payment" ? card_id : kind === "card" ? originId : null,
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateTx(result.value.affectedCardIds);
  return { ok: true };
}

export async function deleteTransaction(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const result = await deleteMovement(await repositories(), id);
  if (result.ok) revalidateTx(result.value.affectedCardIds);
}
