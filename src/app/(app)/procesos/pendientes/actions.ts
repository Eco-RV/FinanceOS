"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncConnection } from "@/lib/mail/sync";
import {
  approvePending as approvePendingUseCase,
  rejectPending as rejectPendingUseCase,
} from "@/application";
import { repositories } from "@/infrastructure/container";

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
  | { ok: true; imported: number; found: number }
  | { ok: false; message: string };

/** "Sincronizar ahora": mismo proceso que el cron, con la sesión del usuario. */
export async function syncNow(): Promise<SyncNowResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: conn } = await supabase
    .from("mail_connections")
    .select("user_id, refresh_token_enc, last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conn) return { ok: false, message: "Conecta tu correo en Ajustes → Bancos" };

  try {
    const r = await syncConnection(supabase, conn);
    revalidate();
    return { ok: true, imported: r.imported, found: r.found };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "No se pudo sincronizar",
    };
  }
}
