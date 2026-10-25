"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { FormResult } from "@/lib/forms";
import { toFormResult } from "@/lib/catalog-actions";
import { saveFavorites } from "@/application";
import { repositories } from "@/infrastructure/container";

const favorites = z.array(z.string().max(40)).max(20);

/** U11 (3.2.1): guarda la cinta de favoritos del Resumen (claves `favorite`, en orden). */
export async function saveFavoritesAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const parsed = favorites.safeParse(formData.getAll("favorite"));
  if (!parsed.success) return { ok: false, message: "No se pudieron leer los favoritos" };
  const result = await saveFavorites((await repositories()).profiles, parsed.data);
  if (result.ok) revalidatePath("/dashboard");
  return toFormResult(result);
}
