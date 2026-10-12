"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { crToday, isCurrency, toISODate, type FreshStartOpening } from "@/domain";
import { freshStart } from "@/application";
import { repositories } from "@/infrastructure/container";
import type { FormResult } from "@/lib/forms";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Campos `opening:<account|card>:<id>:<CRC|USD>` del formulario. */
const OPENING = /^opening:(account|card):([0-9a-fA-F-]{36}):(CRC|USD)$/;

export type FreshStartResult = FormResult | { ok: true; archived: number };

/** M8: arranque de 0 completo, en una sola transacción de la base. */
export async function freshStartAction(formData: FormData): Promise<FreshStartResult> {
  await requireUser();

  const on = String(formData.get("on") ?? "");
  if (!ISO.test(on)) return { ok: false, errors: { on: "Fecha inválida" } };

  const openings: FreshStartOpening[] = [];
  for (const [name, raw] of formData.entries()) {
    const m = OPENING.exec(name);
    if (!m || !isCurrency(m[3])) continue;
    const text = String(raw).trim();
    const amount = text === "" ? 0 : Number(text);
    if (!Number.isFinite(amount)) return { ok: false, message: "Hay un saldo inicial inválido" };
    openings.push({ kind: m[1] as "account" | "card", id: m[2], currency: m[3], amount });
  }

  const result = await freshStart(await repositories(), {
    confirmation: String(formData.get("confirmation") ?? ""),
    todayISO: toISODate(crToday()),
    on,
    openings,
  });
  if (!result.ok) return { ok: false, message: result.message };

  // Cambia todo: listas, saldos, tarjetas, préstamos y el Resumen.
  revalidatePath("/", "layout");
  return { ok: true, archived: result.value.archived };
}
