"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tryFormat, type FormatTrial } from "@/lib/mail/parsers/try-format";

export async function disconnectMail() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("mail_connections").delete().eq("user_id", user.id);
  revalidatePath("/ajustes/bancos");
  revalidatePath("/procesos/pendientes");
}

const trialSchema = z.object({
  parser_key: z.string().trim().min(1).max(40),
  content: z.string().max(200_000),
  subject: z.string().max(300).optional(),
});

/**
 * 3.3.0 · "Probar formato": el usuario pega un aviso real y ve qué lee el
 * formato del banco. No guarda nada.
 */
export async function testBankFormat(input: {
  parser_key: string;
  content: string;
  subject?: string;
}): Promise<FormatTrial> {
  await requireUser();
  const parsed = trialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "El aviso es demasiado largo", labels: [] };
  return tryFormat(parsed.data.parser_key, parsed.data.content, parsed.data.subject ?? "");
}
