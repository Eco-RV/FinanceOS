/**
 * Adaptador Supabase de planes recurrentes y metas de ahorro (2.7.0). SQL en
 * `supabase/Versionamiento/2.7.0/`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  InfrastructureError,
  type Goal,
  type GoalRepository,
  type Plan,
  type PlanRepository,
} from "@/application";

const UNIQUE_VIOLATION = "23505";
/** La tabla no existe (SQL 2.7.0 sin correr). */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

const PLAN_COLUMNS =
  "id, kind, name, amount, currency, frequency, starts_on, ends_on, account_id, card_id, category, note, generated_through, archived";
/** 2.8.0: tarjeta de débito del plan (columna nueva). */
const PLAN_COLUMNS_V280 = `${PLAN_COLUMNS}, debit_card_id`;
/** 3.0.1 (P7): monto variable. */
const PLAN_COLUMNS_V301 = `${PLAN_COLUMNS_V280}, variable`;
/** La columna no existe (SQL 2.8.0 sin correr): se lee y guarda sin ella. */
const MISSING_COLUMN = new Set(["42703", "PGRST204"]);

function toPlan(row: Record<string, unknown>): Plan {
  return {
    ...(row as unknown as Plan),
    amount: Number(row.amount),
  };
}

export function supabasePlans(supabase: SupabaseClient) {
  const plans: PlanRepository = {
    async list() {
      const read = (columns: string) =>
        supabase.from("plans").select(columns).order("created_at", { ascending: true });
      let { data, error } = await read(PLAN_COLUMNS_V301);
      if (error?.code && MISSING_COLUMN.has(error.code)) ({ data, error } = await read(PLAN_COLUMNS_V280));
      if (error?.code && MISSING_COLUMN.has(error.code)) ({ data, error } = await read(PLAN_COLUMNS));
      if (error) {
        if (error.code && MISSING_TABLE.has(error.code)) return [];
        throw new InfrastructureError("No se pudieron leer los planes");
      }
      return ((data ?? []) as unknown as Record<string, unknown>[]).map(toPlan);
    },
    async find(id) {
      const read = (columns: string) =>
        supabase.from("plans").select(columns).eq("id", id).maybeSingle();
      let { data, error } = await read(PLAN_COLUMNS_V301);
      if (error?.code && MISSING_COLUMN.has(error.code)) ({ data, error } = await read(PLAN_COLUMNS_V280));
      if (error?.code && MISSING_COLUMN.has(error.code)) ({ data, error } = await read(PLAN_COLUMNS));
      return data ? toPlan(data as unknown as Record<string, unknown>) : null;
    },
    async save(id, fields, generatedThrough) {
      const write = (row: Record<string, unknown>) =>
        id
          ? supabase.from("plans").update(row).eq("id", id).select("id").single()
          : supabase
              .from("plans")
              .insert({ ...row, generated_through: generatedThrough ?? null })
              .select("id")
              .single();
      const { variable, ...rest } = fields;
      let { data, error } = await write({ ...rest, debit_card_id: fields.debit_card_id ?? null, variable: Boolean(variable) });
      // Sin el SQL 3.0.1 (P7) se guarda sin la columna, salvo que el plan sea variable.
      if (error?.code && MISSING_COLUMN.has(error.code) && !variable) {
        ({ data, error } = await write({ ...rest, debit_card_id: fields.debit_card_id ?? null }));
      } else if (error?.code && MISSING_COLUMN.has(error.code)) {
        throw new InfrastructureError("Falta correr el SQL de la versión 3.0.1 (planes con monto variable)");
      }
      // Sin el SQL 2.8.0 se guarda igual, salvo que el plan use tarjeta de débito.
      if (error?.code && MISSING_COLUMN.has(error.code)) {
        if (fields.debit_card_id) {
          throw new InfrastructureError("Falta correr el SQL de la versión 2.8.0 (tarjetas de débito)");
        }
        const { debit_card_id: _omit, variable: _v, ...legacy } = fields;
        void _v;
        void _omit;
        ({ data, error } = await write(legacy));
      }
      if (error?.code && MISSING_TABLE.has(error.code)) {
        throw new InfrastructureError("Falta correr el SQL de la versión 2.7.0 (planes)");
      }
      if (error) throw new InfrastructureError("No se pudo guardar el plan");
      return { id: data!.id as string };
    },
    async setArchived(id, archived, generatedThrough) {
      const patch: Record<string, unknown> = { archived };
      if (generatedThrough !== undefined) patch.generated_through = generatedThrough;
      const { error } = await supabase.from("plans").update(patch).eq("id", id);
      if (error) throw new InfrastructureError("No se pudo actualizar el plan");
    },
    async delete(id) {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw new InfrastructureError("No se pudo eliminar el plan");
    },
    async materialize(planId, through, rows) {
      const { data, error } = await supabase.rpc("materialize_plan", {
        p_plan_id: planId,
        p_through: through,
        p_rows: rows.map((r) => ({
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          occurred_on: r.occurred_on,
          category: r.category ?? "",
          note: r.note ?? "",
          account_id: r.account_id ?? "",
          card_id: r.card_id ?? "",
          debit_card_id: r.debit_card_id ?? "",
          estimated: Boolean(r.estimated),
        })),
      });
      if (error) throw new InfrastructureError("No se pudieron registrar los movimientos del plan");
      return Number(data ?? 0);
    },
    async estimatedOccurrences() {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, plan_id, occurred_on, amount, currency, plans(name, kind)")
        .eq("estimated", true)
        .eq("archived", false)
        .not("plan_id", "is", null)
        .order("occurred_on", { ascending: true });
      if (error) return [];
      return ((data ?? []) as Record<string, unknown>[]).map((r) => {
        const plan = r.plans as { name: string; kind: Plan["kind"] } | null;
        return {
          movement_id: r.id as string,
          plan_id: r.plan_id as string,
          plan_name: plan?.name ?? "Plan",
          kind: plan?.kind ?? "salary",
          occurred_on: r.occurred_on as string,
          amount: Number(r.amount),
          currency: r.currency === "USD" ? "USD" : "CRC",
        };
      });
    },
    async confirmOccurrence(movementId, amount) {
      const { error } = await supabase
        .from("transactions")
        .update({ amount, estimated: false })
        .eq("id", movementId);
      if (error) throw new InfrastructureError("No se pudo confirmar el monto");
    },
  };

  const goals: GoalRepository = {
    async find(id) {
      const { data } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return data
        ? ({ ...data, target_amount: Number(data.target_amount), allocated: Number(data.allocated ?? 0) } as Goal)
        : null;
    },
    // A4 (3.0.1): apartados de varias metas en una cuenta.
    async onAccount(accountId) {
      const { data } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("account_id", accountId)
        .eq("archived", false);
      return ((data ?? []) as { id: string; allocated?: number }[]).map((g) => ({
        id: g.id,
        allocated: Number(g.allocated ?? 0),
      }));
    },
    async accountBalance(accountId) {
      const { data } = await supabase.from("accounts").select("current_balance").eq("id", accountId).maybeSingle();
      return data ? Number(data.current_balance) : null;
    },
    async setAllocated(id, allocated) {
      const { error } = await supabase.from("savings_goals").update({ allocated }).eq("id", id);
      if (error) throw new InfrastructureError("No se pudo apartar (¿corriste el SQL 3.0.1?)");
    },
    async save(id, fields) {
      const { data, error } = id
        ? await supabase.from("savings_goals").update(fields).eq("id", id).select("id").single()
        : await supabase.from("savings_goals").insert(fields).select("id").single();
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Esa cuenta ya tiene una meta activa (corre el SQL 3.0.1 para tener varias)");
      }
      if (error?.code && MISSING_TABLE.has(error.code)) {
        throw new InfrastructureError("Falta correr el SQL de la versión 2.7.0 (metas)");
      }
      if (error) throw new InfrastructureError("No se pudo guardar la meta");
      return { id: data!.id as string };
    },
    async setArchived(id, archived) {
      const { error } = await supabase.from("savings_goals").update({ archived }).eq("id", id);
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Esa cuenta ya tiene otra meta activa");
      }
      if (error) throw new InfrastructureError("No se pudo actualizar la meta");
    },
    async delete(id) {
      const { error } = await supabase.from("savings_goals").delete().eq("id", id);
      if (error) throw new InfrastructureError("No se pudo eliminar la meta");
    },
  };

  return { plans, goals };
}
