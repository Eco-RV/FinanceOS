/**
 * Adaptador Supabase de gastos compartidos (3.1.0, X1–X6). SQL en
 * `supabase/Versionamiento/3.1.0/`. Sin ese SQL, `linkOf` devuelve `null`, así
 * que el libro de movimientos sigue funcionando igual.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  InfrastructureError,
  type SharedExpenseRepository,
  type SharedPartRecord,
  type StoredSharedExpense,
} from "@/application";
import { isCurrency, type MovementType } from "@/domain";

const UNIQUE_VIOLATION = "23505";
/** La tabla no existe (SQL 3.1.0 sin correr). */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

type PgError = { code?: string; message?: string } | null;

function check(error: PgError, message: string): void {
  if (!error) return;
  if (error.code && MISSING_TABLE.has(error.code)) {
    throw new InfrastructureError("Falta correr el SQL 3.1.0 (gastos compartidos) en Supabase");
  }
  throw new InfrastructureError(message);
}

function toPart(row: Record<string, unknown>): SharedPartRecord {
  return {
    member_id: row.member_id as string,
    amount: Number(row.amount),
    paid_on: (row.paid_on as string | null) ?? null,
    channel: (row.channel as SharedPartRecord["channel"]) ?? null,
    note: (row.note as string | null) ?? null,
    income_transaction_id: (row.income_transaction_id as string | null) ?? null,
  };
}

const PART_COLUMNS = "member_id, amount, paid_on, channel, note, income_transaction_id";

export function supabaseSharedExpenses(supabase: SupabaseClient) {
  const sharedExpenses: SharedExpenseRepository = {
    async source(movementId) {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, type, amount, currency, occurred_on, account_id, card_id, note, financing_id, loan_id, credit_cards(cutoff_day, payment_due_day, cutoff_day_rolls_over)",
        )
        .eq("id", movementId)
        .eq("archived", false)
        .maybeSingle();
      check(error, "No se pudo leer el movimiento");
      if (!data) return null;
      const row = data as Record<string, unknown>;
      const card = row.credit_cards as
        | { cutoff_day: number; payment_due_day: number; cutoff_day_rolls_over?: boolean | null }
        | null;
      return {
        movement_id: row.id as string,
        type: row.type as MovementType,
        amount: Number(row.amount),
        currency: isCurrency(String(row.currency)) ? (row.currency as "CRC" | "USD") : "CRC",
        occurred_on: row.occurred_on as string,
        account_id: (row.account_id as string | null) ?? null,
        card: row.card_id && card ? { id: row.card_id as string, ...card } : null,
        note: (row.note as string | null) ?? null,
        managed_elsewhere: Boolean(row.financing_id || row.loan_id),
      };
    },

    async linkOf(movementId) {
      const [asExpense, asIncome] = await Promise.all([
        supabase
          .from("shared_expenses")
          .select("id")
          .eq("transaction_id", movementId)
          .eq("archived", false)
          .maybeSingle(),
        supabase
          .from("shared_expense_parts")
          .select("shared_expense_id")
          .eq("income_transaction_id", movementId)
          .limit(1)
          .maybeSingle(),
      ]);
      for (const r of [asExpense, asIncome]) {
        if (r.error && !(r.error.code && MISSING_TABLE.has(r.error.code))) {
          throw new InfrastructureError("No se pudo revisar si el movimiento está compartido");
        }
      }
      if (asExpense.data) return { shared_expense_id: asExpense.data.id as string, role: "expense" };
      if (asIncome.data) {
        return { shared_expense_id: asIncome.data.shared_expense_id as string, role: "income" };
      }
      return null;
    },

    async find(id) {
      const { data, error } = await supabase
        .from("shared_expenses")
        .select(
          `id, transaction_id, description, currency, total_amount, due_on, transactions(occurred_on, card_id), shared_expense_parts(${PART_COLUMNS}, archived)`,
        )
        .eq("id", id)
        .eq("archived", false)
        .maybeSingle();
      check(error, "No se pudo leer el gasto compartido");
      if (!data) return null;
      const row = data as Record<string, unknown>;
      const tx = row.transactions as { occurred_on: string; card_id: string | null } | null;
      const parts = ((row.shared_expense_parts as Record<string, unknown>[] | null) ?? [])
        .filter((p) => !p.archived)
        .map(toPart);
      const stored: StoredSharedExpense = {
        id: row.id as string,
        transaction_id: row.transaction_id as string,
        description: row.description as string,
        currency: row.currency === "USD" ? "USD" : "CRC",
        total_amount: Number(row.total_amount),
        occurred_on: tx?.occurred_on ?? (row.due_on as string),
        due_on: row.due_on as string,
        card_id: tx?.card_id ?? null,
        parts,
      };
      return stored;
    },

    async create(input) {
      const { data, error } = await supabase
        .from("shared_expenses")
        .insert({
          transaction_id: input.transaction_id,
          description: input.description.slice(0, 80),
          currency: input.currency,
          total_amount: input.total_amount,
          due_on: input.due_on,
        })
        .select("id")
        .single();
      if (error?.code === UNIQUE_VIOLATION) throw new InfrastructureError("Ese gasto ya está compartido");
      check(error, "No se pudo compartir el gasto");
      const id = data!.id as string;
      const { error: partsError } = await supabase
        .from("shared_expense_parts")
        .insert(input.shares.map((s) => ({ shared_expense_id: id, member_id: s.member_id, amount: s.amount })));
      if (partsError) {
        await supabase.from("shared_expenses").delete().eq("id", id);
        check(partsError, "No se pudieron guardar las partes");
      }
      return { id };
    },

    async update(id, fields) {
      const { error } = await supabase
        .from("shared_expenses")
        .update({ description: fields.description.slice(0, 80), due_on: fields.due_on })
        .eq("id", id);
      check(error, "No se pudo actualizar el gasto compartido");

      const { data: rows, error: readError } = await supabase
        .from("shared_expense_parts")
        .select("member_id, paid_on")
        .eq("shared_expense_id", id);
      check(readError, "No se pudieron leer las partes");
      const before = new Map((rows ?? []).map((r) => [r.member_id as string, r.paid_on as string | null]));
      const keep = new Set(fields.shares.map((s) => s.member_id));

      const removed = [...before.entries()].filter(([m, paid]) => !keep.has(m) && !paid).map(([m]) => m);
      if (removed.length > 0) {
        const { error: delError } = await supabase
          .from("shared_expense_parts")
          .delete()
          .eq("shared_expense_id", id)
          .in("member_id", removed);
        check(delError, "No se pudieron quitar las partes");
      }
      for (const s of fields.shares) {
        if (before.get(s.member_id)) continue; // ya pagó: no se toca (X6)
        const { error: upError } = before.has(s.member_id)
          ? await supabase
              .from("shared_expense_parts")
              .update({ amount: s.amount })
              .eq("shared_expense_id", id)
              .eq("member_id", s.member_id)
          : await supabase
              .from("shared_expense_parts")
              .insert({ shared_expense_id: id, member_id: s.member_id, amount: s.amount });
        check(upError, "No se pudieron guardar las partes");
      }
    },

    async setPayment(id, memberId, payment) {
      const { error } = await supabase
        .from("shared_expense_parts")
        .update({
          paid_on: payment?.paid_on ?? null,
          channel: payment?.channel ?? null,
          note: payment?.note ?? null,
          income_transaction_id: payment?.income_transaction_id ?? null,
        })
        .eq("shared_expense_id", id)
        .eq("member_id", memberId);
      check(error, "No se pudo registrar el pago");
    },

    async delete(id) {
      const { error } = await supabase.from("shared_expenses").delete().eq("id", id);
      check(error, "No se pudo dejar de compartir el gasto");
    },

    async recordNotices(items) {
      const { error } = await supabase.from("shared_expense_notices").insert(items);
      check(error, "No se pudo registrar el aviso");
    },
  };

  return { sharedExpenses };
}
