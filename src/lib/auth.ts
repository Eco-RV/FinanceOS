import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/preferences";

/** Returns the current user (or null). Memoized per request. */
export const getUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    // Supabase not configured yet, or auth service unreachable.
    return null;
  }
});

/**
 * Returns the current user or redirects to /login. Use in protected pages/actions.
 * 3.2.0: también carga las preferencias del request (formato de fecha) en
 * paralelo con la sesión, antes de que la página pinte nada.
 */
export const requireUser = cache(async () => {
  const [user] = await Promise.all([getUser(), getPreferences()]);
  if (!user) redirect("/login");
  return user;
});
