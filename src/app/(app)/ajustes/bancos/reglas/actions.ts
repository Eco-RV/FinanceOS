"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { FormResult } from "@/lib/forms";
import { toFormResult } from "@/lib/catalog-actions";
import { changeMerchantRule, deleteMerchantRule } from "@/application";
import { repositories } from "@/infrastructure/container";

export async function changeRuleAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const result = await changeMerchantRule(await repositories(), {
    id: String(formData.get("id") ?? ""),
    category: String(formData.get("category") ?? ""),
  });
  if (result.ok) revalidatePath("/ajustes/bancos/reglas");
  return toFormResult(result);
}

export async function deleteRuleAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const result = await deleteMerchantRule((await repositories()).merchantRules, String(formData.get("id") ?? ""));
  if (result.ok) revalidatePath("/ajustes/bancos/reglas");
  return toFormResult(result);
}
