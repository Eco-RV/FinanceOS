/**
 * Adaptador Supabase de los puertos de `src/application/ports.ts`. Corre con
 * el cliente del usuario autenticado, así que RLS aísla los datos de cada
 * usuario. El saldo (`current_balance`) lo mantiene el trigger
 * `transactions_balance_sync`, con la misma convención que `balanceEffects`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCurrency, type Currency, type Movement } from "@/domain";
import {
  InfrastructureError,
  type AccountRepository,
  type BalanceRepository,
  type BankRepository,
  type CardRepository,
  type CategoryKind,
  type CategoryRepository,
  type ExchangeRateRepository,
  type FinancingRepository,
  type MerchantRuleRepository,
  type MovementRepository,
  type PendingPurchase,
  type PendingRepository,
} from "@/application";

type PgError = { message: string; code?: string } | null;

function check(error: PgError, message: string): void {
  if (error) throw new InfrastructureError(message);
}

/** Violación de un índice único (p. ej. categoría repetida). */
const UNIQUE_VIOLATION = "23505";

/** Patrón `ilike` que compara el texto completo, sin comodines del usuario. */
function exactILike(text: string): string {
  return text.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
}

type CatalogTable = "accounts" | "credit_cards" | "categories" | "banks";

async function findEntry<Extra extends string = never>(
  supabase: SupabaseClient,
  table: CatalogTable,
  id: string,
  extra: Extra[] = [],
) {
  const { data } = await supabase
    .from(table)
    .select(["name", "archived", ...extra].join(", "))
    .eq("id", id)
    .maybeSingle();
  return (data as ({ name: string; archived: boolean } & Record<Extra, string | null>) | null) ?? null;
}

async function setArchived(
  supabase: SupabaseClient,
  table: CatalogTable,
  id: string,
  archived: boolean,
  message: string,
): Promise<void> {
  const { error } = await supabase.from(table).update({ archived }).eq("id", id);
  check(error, message);
}

/** Cuenta filas sin traerlas (`head`). */
async function count(
  query: PromiseLike<{ count: number | null; error: PgError }>,
  message: string,
): Promise<number> {
  const { count: n, error } = await query;
  check(error, message);
  return n ?? 0;
}

const HISTORY_ERROR = "No se pudo revisar la historia";

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

async function saveRow(
  supabase: SupabaseClient,
  table: "accounts" | "credit_cards",
  id: string | null,
  fields: object,
  message: string,
): Promise<{ id: string }> {
  if (id) {
    const { error } = await supabase.from(table).update(fields).eq("id", id);
    check(error, message);
    return { id };
  }
  const { data, error } = await supabase.from(table).insert(fields).select("id").single();
  check(error, message);
  return { id: data!.id as string };
}

export function supabaseRepositories(supabase: SupabaseClient) {
  const accounts: AccountRepository = {
    currencyOf: (id) => currencyOf(supabase, "accounts", id),
    find: (id) => findEntry(supabase, "accounts", id),
    // G5: movimientos propios (origen o destino), sin su saldo inicial;
    // archivados incluidos, también son historia.
    historyCount: (id) =>
      count(
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .neq("type", "opening_balance")
          .or(`account_id.eq.${id},to_account_id.eq.${id}`),
        HISTORY_ERROR,
      ),
    setArchived: (id, archived) =>
      setArchived(supabase, "accounts", id, archived, "No se pudo actualizar la cuenta"),
    save: (id, fields) =>
      saveRow(supabase, "accounts", id, fields, "No se pudo guardar la cuenta"),
    async delete(id) {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      check(error, "No se pudo eliminar la cuenta");
    },
  };

  const cards: CardRepository = {
    currencyOf: (id) => currencyOf(supabase, "credit_cards", id),
    find: (id) => findEntry(supabase, "credit_cards", id, ["bank_id"]),
    async historyCount(id) {
      const [movementCount, financingCount] = await Promise.all([
        count(
          supabase
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .neq("type", "opening_balance")
            .eq("card_id", id),
          HISTORY_ERROR,
        ),
        count(
          supabase
            .from("financings")
            .select("id", { count: "exact", head: true })
            .eq("card_id", id),
          HISTORY_ERROR,
        ),
      ]);
      return movementCount + financingCount;
    },
    setArchived: (id, archived) =>
      setArchived(supabase, "credit_cards", id, archived, "No se pudo actualizar la tarjeta"),
    save: (id, fields) =>
      saveRow(supabase, "credit_cards", id, fields, "No se pudo guardar la tarjeta"),
    async delete(id) {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id);
      check(error, "No se pudo eliminar la tarjeta");
    },
  };

  const categories: CategoryRepository = {
    find: (id) => findEntry(supabase, "categories", id, ["kind"]) as ReturnType<CategoryRepository["find"]>,
    async historyCount(id) {
      const category = await findEntry(supabase, "categories", id, ["kind"]);
      if (!category) return 0;
      // `transactions.category` es texto libre: se casa por nombre y tipo.
      return count(
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("type", category.kind as CategoryKind)
          .ilike("category", exactILike(category.name)),
        HISTORY_ERROR,
      );
    },
    async setArchived(id, archived) {
      const { error } = await supabase.from("categories").update({ archived }).eq("id", id);
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Ya hay una categoría activa con ese nombre");
      }
      check(error, "No se pudo actualizar la categoría");
    },
    async save(id, fields) {
      const { data, error } = id
        ? await supabase.from("categories").update(fields).eq("id", id).select("id").single()
        : await supabase.from("categories").insert(fields).select("id").single();
      if (error?.code === UNIQUE_VIOLATION) throw new InfrastructureError("Ya existe esa categoría");
      check(error, "No se pudo guardar la categoría");
      return { id: data!.id as string };
    },
    async names(kind) {
      const { data, error } = await supabase.from("categories").select("name").eq("kind", kind);
      check(error, "No se pudieron leer las categorías");
      return (data ?? []).map((c) => c.name as string);
    },
    async createMany(rows) {
      const { error } = await supabase.from("categories").insert(rows);
      check(error, "No se pudieron cargar las categorías");
    },
    async isDeactivated(kind, name) {
      const { data, error } = await supabase
        .from("categories")
        .select("archived")
        .eq("kind", kind)
        .ilike("name", exactILike(name));
      check(error, "No se pudieron leer las categorías");
      return (data ?? []).length > 0 && (data ?? []).every((c) => c.archived);
    },
    async delete(id) {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      check(error, "No se pudo eliminar la categoría");
    },
  };

  const banks: BankRepository = {
    find: (id) => findEntry(supabase, "banks", id),
    // G5: los avisos importados (en cualquier estado) son la historia del banco.
    historyCount: (id) =>
      count(
        supabase
          .from("pending_transactions")
          .select("id", { count: "exact", head: true })
          .eq("bank_id", id),
        HISTORY_ERROR,
      ),
    setArchived: (id, archived) =>
      setArchived(supabase, "banks", id, archived, "No se pudo actualizar el banco"),
    async save(id, fields) {
      const { data, error } = id
        ? await supabase.from("banks").update(fields).eq("id", id).select("id").single()
        : await supabase.from("banks").insert(fields).select("id").single();
      check(error, "No se pudo guardar el banco");
      return { id: data!.id as string };
    },
    async delete(id) {
      const { error } = await supabase.from("banks").delete().eq("id", id);
      check(error, "No se pudo eliminar el banco");
    },
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
    async categoryOf(id) {
      const { data } = await supabase
        .from("transactions")
        .select("category")
        .eq("id", id)
        .maybeSingle();
      return data?.category ?? null;
    },
    async openingOf(target, id, currency) {
      const { data } = await supabase
        .from("transactions")
        .select("id, amount, occurred_on")
        .eq("type", "opening_balance")
        .eq(target === "account" ? "account_id" : "card_id", id)
        .eq("currency", currency)
        .eq("archived", false)
        .maybeSingle();
      return data ? { id: data.id, amount: Number(data.amount), occurred_on: data.occurred_on } : null;
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
    async createWithInstallments(plan, installments) {
      // Guarda exactamente el plan que calculó el dominio, de forma atómica
      // (supabase/Versionamiento/2.0.0/03_create_financing_v2.sql).
      const { data, error } = await supabase.rpc("create_financing_v2", {
        p_card_id: plan.card_id,
        p_description: plan.description,
        p_category: plan.category,
        p_total_amount: plan.total_amount,
        p_months: plan.months,
        p_first_charge_on: plan.first_charge_on,
        p_installments: installments.map((c) => ({
          no: c.no,
          occurred_on: c.occurred_on,
          amount: c.amount,
        })),
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
    async cancel(id, todayISO) {
      // supabase/Versionamiento/2.0.0/04_cancel_financing.sql
      const { data, error } = await supabase.rpc("cancel_financing", {
        p_financing_id: id,
        p_today: todayISO,
      });
      check(error, "No se pudo eliminar el financiamiento");
      return data === "deleted" ? "deleted" : "cancelled";
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

  const balances: BalanceRepository = {
    async stored() {
      const [{ data: acc, error: e1 }, { data: crd, error: e2 }] = await Promise.all([
        supabase.from("accounts").select("id, current_balance"),
        supabase.from("credit_cards").select("id, current_balance, usd_balance"),
      ]);
      check(e1 ?? e2, "No se pudieron leer los saldos");
      return [
        ...(acc ?? []).map((r) => ({
          target: "account" as const,
          id: r.id as string,
          stored: Number(r.current_balance),
        })),
        // T1: una fila por moneda (current_balance = CRC, usd_balance = USD).
        ...(crd ?? []).flatMap((r) => [
          {
            target: "card" as const,
            id: r.id as string,
            currency: "CRC" as const,
            stored: Number(r.current_balance),
          },
          {
            target: "card" as const,
            id: r.id as string,
            currency: "USD" as const,
            stored: Number(r.usd_balance ?? 0),
          },
        ]),
      ];
    },
    async movements() {
      // PostgREST devuelve como máximo ~1000 filas por consulta: se pagina.
      const PAGE = 1000;
      const all: Movement[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("transactions")
          .select("type, amount, currency, account_id, card_id, to_account_id, archived")
          .order("id")
          .range(from, from + PAGE - 1);
        check(error, "No se pudieron leer los movimientos");
        all.push(...((data ?? []) as Movement[]));
        if (!data || data.length < PAGE) return all;
      }
    },
    async recompute() {
      const { data, error } = await supabase.rpc("recompute_balances");
      check(error, "No se pudieron recalcular los saldos");
      return Number(data) || 0;
    },
  };

  const exchangeRates: ExchangeRateRepository = {
    async latest() {
      const { data } = await supabase
        .from("exchange_rates")
        .select("rate_on, usd_crc")
        .eq("archived", false)
        .order("rate_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { rate_on: data.rate_on, usd_crc: Number(data.usd_crc) } : null;
    },
    async save(rate) {
      const { error } = await supabase
        .from("exchange_rates")
        .upsert(rate, { onConflict: "user_id,rate_on" });
      check(error, "No se pudo guardar el tipo de cambio");
    },
  };

  return {
    accounts,
    cards,
    categories,
    banks,
    movements,
    financings,
    pending,
    merchantRules,
    balances,
    exchangeRates,
  };
}

export type Repositories = ReturnType<typeof supabaseRepositories>;
