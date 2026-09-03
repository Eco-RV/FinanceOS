"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión de Supabase y manda al login. */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
