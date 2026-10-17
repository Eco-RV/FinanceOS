"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { accountSchema, debitCardSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import {
  removeFromCatalog,
  saveAccount as saveAccountUseCase,
  saveDebitCard as saveDebitCardUseCase,
  setCatalogActive,
} from "@/application";
import { lifecycleForm, toFormResult } from "@/lib/catalog-actions";
import { repositories } from "@/infrastructure/container";

function revalidate() {
  revalidatePath("/procesos/cuentas", "layout");
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

// ─────────────────────  tarjeta de débito (2.8.0, C3)  ─────────────────────

function revalidateAccount(accountId?: string | null) {
  revalidate();
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/planes");
  if (accountId) revalidatePath(`/procesos/cuentas/${accountId}`);
}

export async function saveDebitCard(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const id = (formData.get("id") as string) || null;
  const parsed = debitCardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const result = await saveDebitCardUseCase(await repositories(), { id, fields: parsed.data });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateAccount(parsed.data.account_id);
  return { ok: true };
}

/** G5: solo se elimina una tarjeta de débito sin gastos registrados. */
export async function deleteDebitCard(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta la tarjeta" };

  const { debitCards } = await repositories();
  const accountId = (await debitCards.find(id))?.account_id;
  const result = await removeFromCatalog(debitCards, "debitCard", id);
  if (result.ok) revalidateAccount(accountId);
  return toFormResult(result);
}

/** Desactiva o reactiva la tarjeta de débito; sus gastos se conservan. */
export async function setDebitCardActive(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id, active } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta la tarjeta" };

  const { debitCards } = await repositories();
  const accountId = (await debitCards.find(id))?.account_id;
  const result = await setCatalogActive(debitCards, "debitCard", id, active);
  if (result.ok) revalidateAccount(accountId);
  return toFormResult(result);
}
