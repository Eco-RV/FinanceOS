"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { FormResult } from "@/lib/forms";
import { toFormResult } from "@/lib/catalog-actions";
import { savePreferences } from "@/application";
import { FEATURE_KEYS, dismissSuggestion, setFeatureChoice, type FeatureState } from "@/domain";
import { repositories } from "@/infrastructure/container";
import { getFeatureState } from "@/lib/features";

const featureKey = z.enum(FEATURE_KEYS);

async function save(next: (state: FeatureState) => FeatureState): Promise<FormResult> {
  const state = await getFeatureState();
  const result = await savePreferences((await repositories()).profiles, { features: next(state) });
  // La navegación de toda la app depende de las funciones encendidas.
  if (result.ok) revalidatePath("/", "layout");
  return toFormResult(result);
}

/** 3.2.0 (E3): activar o apagar una función del catálogo. */
export async function setFeatureAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const key = featureKey.safeParse(formData.get("feature"));
  if (!key.success) return { ok: false, message: "Esa función no existe" };
  const on = formData.get("on") === "true";
  return save((state) => setFeatureChoice(state, key.data, on));
}

/** 3.2.0 (E4): "Ahora no" en una sugerencia del Resumen. */
export async function dismissSuggestionAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const key = featureKey.safeParse(formData.get("feature"));
  if (!key.success) return { ok: false, message: "Esa función no existe" };
  return save((state) => dismissSuggestion(state, key.data));
}

/** 3.2.0 (E5): cerrar la tarjeta de primeros pasos. */
export async function closeFirstStepsAction(): Promise<FormResult> {
  await requireUser();
  return save((state) => ({ ...state, stepsClosed: true }));
}

/** 3.2.0 (E5): volver a mostrar los primeros pasos en el Resumen. */
export async function reopenFirstStepsAction(): Promise<FormResult> {
  await requireUser();
  return save((state) => ({ ...state, stepsClosed: false }));
}
