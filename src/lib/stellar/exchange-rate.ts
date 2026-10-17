import type { SupabaseClient } from "@supabase/supabase-js";

/** Último tipo de cambio digitado (Ajustes → Tipo de cambio), para mostrar ≈ colones. */
export async function latestExchangeRate(
  supabase: SupabaseClient,
): Promise<{ usd_crc: number; rate_on: string } | null> {
  const { data } = await supabase
    .from("exchange_rates")
    .select("rate_on, usd_crc")
    .eq("archived", false)
    .order("rate_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { usd_crc: Number(data.usd_crc), rate_on: data.rate_on as string } : null;
}
