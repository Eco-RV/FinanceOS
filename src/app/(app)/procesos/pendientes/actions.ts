"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recordSyncResult, syncConnection } from "@/lib/mail/sync";
import { readAutoApprove } from "@/domain";
import {
  approvePending as approvePendingUseCase,
  autoApprovePending,
  rejectPending as rejectPendingUseCase,
  saveAutoApprove,
} from "@/application";
import { repositories } from "@/infrastructure/container";
import { getPreferencesRaw } from "@/lib/preferences";
import type { FormResult } from "@/lib/forms";

const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/);

const approveSchema = z.object({
  id: uuid,
  card_id: uuid,
  category: z.string().trim().min(1).max(40),
});

function revalidate(cardId?: string | null) {
  revalidatePath("/procesos/pendientes");
  revalidatePath("/procesos");
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/tarjetas");
  revalidatePath("/ajustes/bancos");
  revalidatePath("/dashboard");
  if (cardId) revalidatePath(`/procesos/tarjetas/${cardId}`);
}

/**
 * Confirma un pendiente: crea el gasto en la tarjeta (el trigger de Postgres
 * ajusta el saldo) y aprende comercio → categoría para la próxima vez.
 */
export async function approvePending(formData: FormData) {
  await requireUser();
  const parsed = approveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const result = await approvePendingUseCase(await repositories(), parsed.data);
  if (result.ok) revalidate(parsed.data.card_id);
}

export async function rejectPending(formData: FormData) {
  await requireUser();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;

  const result = await rejectPendingUseCase(await repositories(), id.data);
  if (result.ok) revalidate();
}

export type SyncNowResult =
  | { ok: true; imported: number; found: number; autoApproved: number | null; left: number }
  | { ok: false; message: string };

/**
 * "Sincronizar ahora": mismo proceso que el cron, con la sesión del usuario.
 * Con la aceptación automática encendida (I7, 3.3.0), después acepta las
 * compras que ya tienen tarjeta.
 */
export async function syncNow(): Promise<SyncNowResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: conn } = await supabase
    .from("mail_connections")
    .select("user_id, provider, refresh_token_enc, last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conn) return { ok: false, message: "Conecta tu correo en Ajustes → Bancos" };

  try {
    const r = await syncConnection(supabase, conn);
    let autoApproved: number | null = null;
    let left = 0;
    if (readAutoApprove(await getPreferencesRaw())) {
      const auto = await autoApprovePending(await repositories());
      if (auto.ok) {
        autoApproved = auto.value.approved;
        left = auto.value.left;
        await recordSyncResult(supabase, user.id, { ...r, autoApproved });
      }
    }
    revalidate();
    return { ok: true, imported: r.imported, found: r.found, autoApproved, left };
  } catch (e) {
    revalidatePath("/ajustes/bancos");
    return {
      ok: false,
      message: e instanceof Error ? e.message : "No se pudo sincronizar",
    };
  }
}

/** I7 (3.3.0): interruptor "Aceptar solas al sincronizar". */
export async function setAutoApproveAction(on: boolean): Promise<FormResult> {
  await requireUser();
  const result = await saveAutoApprove((await repositories()).profiles, on);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/procesos/pendientes");
  return { ok: true };
}
