"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fieldErrors, type FormResult } from "@/lib/forms";
import { refreshExchangeRate, setExchangeRate } from "@/application";
import { crToday, toISODate } from "@/domain";
import { repositories } from "@/infrastructure/container";

const rateSchema = z.object({
  rate_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  usd_crc: z.coerce.number().finite("Monto inválido").positive("Debe ser mayor que 0"),
});

/** Guarda el tipo de cambio (colones por dólar) de una fecha (T2). */
export async function saveExchangeRate(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();
  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const result = await setExchangeRate(await repositories(), parsed.data);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/ajustes/tipo-cambio");
  revalidatePath("/procesos/tarjetas", "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** T10 (3.0.1): trae el tipo de cambio de hoy del BCCR (vía Hacienda) y lo guarda. */
export async function fetchOfficialRate(): Promise<FormResult> {
  await requireUser();
  const result = await refreshExchangeRate(await repositories(), { today: toISODate(crToday()), force: true });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/ajustes/tipo-cambio");
  revalidatePath("/procesos/tarjetas", "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}
