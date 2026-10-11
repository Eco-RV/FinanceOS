"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { recomputeBalances } from "@/application";
import { repositories } from "@/infrastructure/container";

export type RecomputeResult = { ok: true; changed: number } | { ok: false; message: string };

/** Reescribe los saldos guardados desde los movimientos (G1). */
export async function recomputeAction(): Promise<RecomputeResult> {
  await requireUser();
  const result = await recomputeBalances(await repositories());
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/ajustes/saldos");
  revalidatePath("/procesos/cuentas");
  revalidatePath("/procesos/tarjetas");
  revalidatePath("/dashboard");
  return { ok: true, changed: result.value.changed };
}
