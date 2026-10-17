"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { planSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import { lifecycleForm, toFormResult } from "@/lib/catalog-actions";
import { crToday, toISODate } from "@/domain";
import { deletePlan, savePlan, setBaselineCap, setPlanActive, syncPlans } from "@/application";
import { repositories } from "@/infrastructure/container";

function revalidate() {
  revalidatePath("/procesos/planes");
  revalidatePath("/dashboard");
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/ingresos");
  revalidatePath("/procesos/cuentas");
  revalidatePath("/procesos/tarjetas");
}

export async function savePlanAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const id = (formData.get("id") as string) || null;
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const { target, ...rest } = parsed.data;
  const [kind, targetId] = target.split(":");
  const today = toISODate(crToday());
  const repos = await repositories();
  // 2.8.0: con tarjeta de débito, el cargo sale de su cuenta.
  const debit = kind === "debit" ? await repos.debitCards.find(targetId) : null;
  const result = await savePlan(repos, {
    id,
    today,
    fields: {
      ...rest,
      frequency: rest.kind === "salary" ? rest.frequency : "monthly",
      account_id: kind === "account" ? targetId : kind === "debit" ? (debit?.account_id ?? null) : null,
      card_id: kind === "card" ? targetId : null,
      debit_card_id: kind === "debit" ? targetId : null,
    },
  });
  if (!result.ok) return { ok: false, message: result.message };
  // Si arranca hoy, que se registre ya.
  await syncPlans(repos.plans, today);
  revalidate();
  return { ok: true };
}

/** Pausar (active=false) o reanudar (active=true). */
export async function setPlanActiveAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id, active } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta el plan" };
  const repos = await repositories();
  const today = toISODate(crToday());
  const result = await setPlanActive(repos.plans, { id, active, today });
  if (result.ok && active) await syncPlans(repos.plans, today);
  if (result.ok) revalidate();
  return toFormResult(result);
}

/** P3: elimina el plan; lo ya registrado queda. */
export async function deletePlanAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;
  const result = await deletePlan((await repositories()).plans, id);
  if (result.ok) revalidate();
}

/** P4: tope de la línea base (% del salario). */
export async function setBaselineCapAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const percent = Number(String(formData.get("cap") ?? "").replace(",", "."));
  const result = await setBaselineCap((await repositories()).profiles, percent);
  if (!result.ok) return { ok: false, errors: { cap: result.message } };
  revalidate();
  return { ok: true };
}
