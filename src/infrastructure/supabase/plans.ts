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

function toPlan(row: Record<string, unknown>): Plan {
  return {
    ...(row as unknown as Plan),
    amount: Number(row.amount),
  };
}

export function supabasePlans(supabase: SupabaseClient) {
  const plans: PlanRepository = {
    async list() {
      const { data, error } = await supabase
        .from("plans")
        .select(PLAN_COLUMNS)
        .order("created_at", { ascending: true });
      if (error) {
        if (error.code && MISSING_TABLE.has(error.code)) return [];
        throw new InfrastructureError("No se pudieron leer los planes");
      }
      return (data ?? []).map(toPlan);
    },
    async find(id) {
      const { data } = await supabase.from("plans").select(PLAN_COLUMNS).eq("id", id).maybeSingle();
      return data ? toPlan(data) : null;
    },
    async save(id, fields, generatedThrough) {
      const { data, error } = id
        ? await supabase.from("plans").update(fields).eq("id", id).select("id").single()
        : await supabase
            .from("plans")
            .insert({ ...fields, generated_through: generatedThrough ?? null })
            .select("id")
            .single();
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
        })),
      });
      if (error) throw new InfrastructureError("No se pudieron registrar los movimientos del plan");
      return Number(data ?? 0);
    },
  };

  const goals: GoalRepository = {
    async find(id) {
      const { data } = await supabase
        .from("savings_goals")
        .select("id, name, target_amount, currency, target_date, account_id, icon, archived")
        .eq("id", id)
        .maybeSingle();
      return data ? ({ ...data, target_amount: Number(data.target_amount) } as Goal) : null;
    },
    async save(id, fields) {
      const { data, error } = id
        ? await supabase.from("savings_goals").update(fields).eq("id", id).select("id").single()
        : await supabase.from("savings_goals").insert(fields).select("id").single();
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Esa cuenta ya tiene una meta activa");
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
