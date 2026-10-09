"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function disconnectMail() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("mail_connections").delete().eq("user_id", user.id);
  revalidatePath("/ajustes/bancos");
  revalidatePath("/procesos/pendientes");
}
