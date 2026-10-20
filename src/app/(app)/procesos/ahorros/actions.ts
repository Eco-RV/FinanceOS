"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { goalSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import { lifecycleForm, toFormResult } from "@/lib/catalog-actions";
import { crToday, toISODate } from "@/domain";
import { allocateToGoal, deleteGoal, saveGoal, setGoalArchived } from "@/application";
import { repositories } from "@/infrastructure/container";

function revalidate() {
  revalidatePath("/procesos/ahorros");
  revalidatePath("/dashboard");
}

export async function saveGoalAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const id = (formData.get("id") as string) || null;
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const repos = await repositories();
  const result = await saveGoal(repos, { id, fields: parsed.data, today: toISODate(crToday()) });
  if (!result.ok) return { ok: false, message: result.message };
  revalidate();
  return { ok: true };
}

/** Archivar una meta lograda o abandonada (active=false) o recuperarla. */
export async function setGoalActiveAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id, active } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta la meta" };
  const result = await setGoalArchived((await repositories()).goals, { id, archived: !active });
  if (result.ok) revalidate();
  return toFormResult(result);
}

export async function deleteGoalAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return { ok: false, message: "Falta la meta" };
  const result = await deleteGoal((await repositories()).goals, id);
  if (result.ok) revalidate();
  return toFormResult(result);
}

/** A4 (3.0.1): apartar parte del saldo de la cuenta para una meta. */
export async function allocateGoalAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const goal_id = String(formData.get("goal_id") ?? "");
  const allocated = Number(formData.get("allocated") || 0);
  const result = await allocateToGoal((await repositories()).goals, { goal_id, allocated });
  if (result.ok) revalidate();
  return toFormResult(result);
}
