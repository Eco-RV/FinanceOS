/**
 * Adaptador Supabase de los puertos de `src/application/ports.ts`. Corre con
 * el cliente del usuario autenticado, así que RLS aísla los datos de cada
 * usuario. El saldo (`current_balance`) lo mantiene el trigger
 * `transactions_balance_sync`, con la misma convención que `balanceEffects`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCurrency, type Currency } from "@/domain";
import {
  InfrastructureError,
  type AccountRepository,
  type CardRepository,
  type FinancingRepository,
  type MerchantRuleRepository,
  type MovementRepository,
  type PendingPurchase,
  type PendingRepository,
} from "@/application";

type PgError = { message: string } | null;

function check(error: PgError, message: string): void {
  if (error) throw new InfrastructureError(message);
}

async function currencyOf(
  supabase: SupabaseClient,
  table: "accounts" | "credit_cards",
  id: string,
): Promise<Currency | null> {
  const { data } = await supabase
    .from(table)
    .select("currency")
    .eq("id", id)
    .eq("archived", false)
    .maybeSingle();
  return data && isCurrency(data.currency) ? data.currency : null;
}

export function supabaseRepositories(supabase: SupabaseClient) {
  const accounts: AccountRepository = {
    currencyOf: (id) => currencyOf(supabase, "accounts", id),
  };

  const cards: CardRepository = {
    currencyOf: (id) => currencyOf(supabase, "credit_cards", id),
  };

  const movements: MovementRepository = {
    async cardIdOf(id) {
      const { data } = await supabase
        .from("transactions")
        .select("card_id")
        .eq("id", id)
        .maybeSingle();
      return data?.card_id ?? null;
    },
    async create(movement) {
      const { data, error } = await supabase
        .from("transactions")
        .insert(movement)
        .select("id")
        .single();
      check(error, "No se pudo guardar el movimiento");
      return { id: data!.id as string };
    },
    async update(id, movement) {
      const { error } = await supabase.from("transactions").update(movement).eq("id", id);
      check(error, "No se pudo actualizar el movimiento");
    },
    async delete(id) {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      check(error, "No se pudo eliminar el movimiento");
    },
  };

  const financings: FinancingRepository = {
    async createWithInstallments(plan) {
      // El SP inserta plan + cuotas en una sola transacción, con el mismo
      // reparto que `installmentSchedule` del dominio.
      const { data, error } = await supabase.rpc("create_financing", {
        p_card_id: plan.card_id,
        p_description: plan.description,
        p_category: plan.category,
        p_total_amount: plan.total_amount,
        p_months: plan.months,
        p_first_charge_on: plan.first_charge_on,
      });
      check(error, "No se pudo crear el financiamiento.");
      return { id: data as string };
    },
    async cardIdOf(id) {
      const { data } = await supabase
        .from("financings")
        .select("card_id")
        .eq("id", id)
        .maybeSingle();
      return data?.card_id ?? null;
    },
    async delete(id) {
      const { error } = await supabase.from("financings").delete().eq("id", id);
      check(error, "No se pudo eliminar el financiamiento");
    },
  };

  const pending: PendingRepository = {
    async findOpen(id) {
      const { data } = await supabase
        .from("pending_transactions")
        .select("id, merchant, amount, currency, occurred_on")
        .eq("id", id)
        .eq("status", "pending")
        .maybeSingle();
      return (data as PendingPurchase | null) ?? null;
    },
    async markApproved(id, movementId, cardId) {
      const { error } = await supabase
        .from("pending_transactions")
        .update({ status: "approved", transaction_id: movementId, card_id: cardId })
        .eq("id", id);
      check(error, "No se pudo marcar el pendiente como aprobado");
    },
    async markRejected(id) {
      const { error } = await supabase
        .from("pending_transactions")
        .update({ status: "rejected" })
        .eq("id", id)
        .eq("status", "pending");
      check(error, "No se pudo descartar el pendiente");
    },
  };

  const merchantRules: MerchantRuleRepository = {
    async learn(key, category) {
      const { data: rule } = await supabase
        .from("merchant_rules")
        .select("id")
        .eq("merchant_key", key)
        .eq("archived", false)
        .maybeSingle();
      const { error } = rule
        ? await supabase.from("merchant_rules").update({ category }).eq("id", rule.id)
        : await supabase.from("merchant_rules").insert({ merchant_key: key, category });
      check(error, "No se pudo guardar la regla del comercio");
    },
  };

  return { accounts, cards, movements, financings, pending, merchantRules };
}

export type Repositories = ReturnType<typeof supabaseRepositories>;
