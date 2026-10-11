import "server-only";

import { createClient } from "@/lib/supabase/server";
import { supabaseRepositories, type Repositories } from "./supabase/repositories";

/**
 * Punto único donde se elige el adaptador de persistencia para los casos de
 * uso. Cambiar de base de datos = cambiar esta función.
 */
export async function repositories(): Promise<Repositories> {
  return supabaseRepositories(await createClient());
}
