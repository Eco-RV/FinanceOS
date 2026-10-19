import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AmortizationEvent } from "@/domain";
import { toLoanAdjustment } from "@/infrastructure/supabase/loan-adjustments";

/**
 * L7/L8 (3.0.1): abonos y cambios de tasa de cada préstamo, en orden, para
 * derivar su calendario (`termsOf(loan, ajustes)`). Sin el SQL 3.0.1, vacío.
 */
export async function loadLoanAdjustments(supabase: SupabaseClient): Promise<Map<string, AmortizationEvent[]>> {
  const { data, error } = await supabase
    .from("loan_adjustments")
    .select("id, loan_id, kind, after_installment, from_installment, amount, mode, annual_rate, occurred_on, transaction_id")
    .eq("archived", false)
    .order("created_at", { ascending: true });
  const out = new Map<string, AmortizationEvent[]>();
  if (error) return out;
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const id = row.loan_id as string;
    out.set(id, [...(out.get(id) ?? []), toLoanAdjustment(row).event]);
  }
  return out;
}
