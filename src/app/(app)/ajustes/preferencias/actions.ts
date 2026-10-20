"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { FormResult } from "@/lib/forms";
import { toFormResult } from "@/lib/catalog-actions";
import { savePreferences } from "@/application";
import { DATE_FORMATS } from "@/domain";
import { repositories } from "@/infrastructure/container";

/** U9 (3.1.0): moneda base y formato de fecha. */
export async function savePreferencesAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const patch: Record<string, unknown> = {};
  const base = formData.get("baseCurrency");
  if (base === "CRC" || base === "USD") patch.baseCurrency = base;
  const df = String(formData.get("dateFormat") ?? "");
  if ((DATE_FORMATS as readonly string[]).includes(df)) patch.dateFormat = df;
  if (Object.keys(patch).length === 0) return { ok: false, message: "Nada que guardar" };
  const result = await savePreferences((await repositories()).profiles, patch);
  if (result.ok) revalidatePath("/", "layout");
  return toFormResult(result);
}
