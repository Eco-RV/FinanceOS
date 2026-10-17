import type { SupabaseClient } from "@supabase/supabase-js";
import type { DebitCard } from "@/lib/types";

/**
 * Tarjetas de débito del usuario (2.8.0). Sin el SQL 2.8.0 (tabla
 * inexistente) devuelve `[]` y la app sigue funcionando.
 */
export async function loadDebitCards(
  supabase: SupabaseClient,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<DebitCard[]> {
  let query = supabase
    .from("debit_cards")
    .select("id, account_id, name, last_four, archived, created_at")
    .order("created_at", { ascending: true });
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as DebitCard[];
}
