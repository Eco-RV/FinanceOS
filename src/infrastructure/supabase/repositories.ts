/**
 * Adaptador Supabase de los puertos de `src/application/ports.ts`. Corre con
 * el cliente del usuario autenticado, así que RLS aísla los datos de cada
 * usuario. El saldo (`current_balance`) lo mantiene el trigger
 * `transactions_balance_sync`, con la misma convención que `balanceEffects`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAccount } from "./account";
import { supabasePlans } from "./plans";
import { supabaseSharedExpenses } from "./shared-expenses";
import { haciendaExchangeRate } from "../exchange/hacienda";
import { supabaseConstellation } from "./constellation";
import { isCurrency, type Currency, type Movement } from "@/domain";
import { decryptToken } from "@/lib/mail/crypto";
import { GmailPermissionError, refreshAccessToken, SEND_SCOPE, sendMessage } from "@/lib/mail/gmail";
import {
  InfrastructureError,
  type AccountRepository,
  type BalanceRepository,
  type BankRepository,
  type CardRepository,
  type CategoryFields,
  type CategoryKind,
  type CategoryRepository,
  type DebitCardRepository,
  type Loan,
  type LoanRepository,
  type Mailer,
  type Member,
  type MemberRepository,
  type NoticeRepository,
  type ReimbursementRepository,
  type ExchangeRateRepository,
  type MinimumPaymentRepository,
  type FinancingRepository,
  type FreshStartRepository,
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
/** PostgREST: la columna no existe en el esquema (SQL de una versión sin correr). */
const MISSING_COLUMN = "PGRST204";

/** Patrón `ilike` que compara el texto completo, sin comodines del usuario. */
function exactILike(text: string): string {
  return text.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
}

type CatalogTable =
  | "accounts"
  | "credit_cards"
  | "categories"
  | "banks"
  | "loans"
  | "members"
  | "debit_cards";

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
    async typeOf(id) {
      const { data } = await supabase
        .from("accounts")
        .select("type")
        .eq("id", id)
        .eq("archived", false)
        .maybeSingle();
      return (data?.type as string | undefined) ?? null;
    },
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

  // 2.8.0 (C3): una tarjeta de débito activa por cuenta (índice único parcial).
  const debitCards: DebitCardRepository = {
    async find(id) {
      const { data } = await supabase
        .from("debit_cards")
        .select("account_id, name, archived")
        .eq("id", id)
        .maybeSingle();
      return (data as { account_id: string; name: string; archived: boolean } | null) ?? null;
    },
    // G5: los gastos pagados con ella (archivados incluidos).
    historyCount: (id) =>
      count(
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("debit_card_id", id),
        HISTORY_ERROR,
      ),
    async setArchived(id, archived) {
      const { error } = await supabase.from("debit_cards").update({ archived }).eq("id", id);
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Esa cuenta ya tiene una tarjeta de débito activa");
      }
      check(error, "No se pudo actualizar la tarjeta de débito");
    },
    async save(id, fields) {
      const { data, error } = id
        ? await supabase
            .from("debit_cards")
            .update({ name: fields.name, last_four: fields.last_four })
            .eq("id", id)
            .select("id")
            .single()
        : await supabase.from("debit_cards").insert(fields).select("id").single();
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Esa cuenta ya tiene una tarjeta de débito activa");
      }
      check(error, "No se pudo guardar la tarjeta de débito");
      return { id: data!.id as string };
    },
    async delete(id) {
      const { error } = await supabase.from("debit_cards").delete().eq("id", id);
      check(error, "No se pudo eliminar la tarjeta de débito");
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
      const write = (row: CategoryFields) =>
        id
          ? supabase.from("categories").update(row).eq("id", id).select("id").single()
          : supabase.from("categories").insert(row).select("id").single();
      let { data, error } = await write(fields);
      // Sin la columna `icon` (SQL 2.5.0 sin correr) se guarda igual, sin ícono.
      if (error?.code === MISSING_COLUMN && "icon" in fields) {
        ({ data, error } = await write({ kind: fields.kind, name: fields.name }));
      }
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

  const LOAN_COLUMNS =
    "id, name, lender, principal, annual_rate, months, currency, first_payment_on, account_id, archived";
  const toLoan = (r: Record<string, unknown>): Loan => ({
    id: r.id as string,
    name: r.name as string,
    lender: (r.lender as string | null) ?? null,
    principal: Number(r.principal),
    annual_rate: Number(r.annual_rate),
    months: Number(r.months),
    currency: isCurrency(String(r.currency)) ? (r.currency as Currency) : "CRC",
    first_payment_on: r.first_payment_on as string,
    account_id: (r.account_id as string | null) ?? null,
    archived: Boolean(r.archived),
  });
  const loanPayments = (loanId: string) =>
    supabase
      .from("transactions")
      .select("id, installment_no")
      .eq("loan_id", loanId)
      .not("installment_no", "is", null)
      .eq("archived", false);

  const loans: LoanRepository = {
    async find(id) {
      const { data } = await supabase.from("loans").select(LOAN_COLUMNS).eq("id", id).maybeSingle();
      return data ? toLoan(data) : null;
    },
    // G5: las cuotas pagadas son la historia; el desembolso no cuenta.
    historyCount: (id) =>
      count(
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("loan_id", id)
          .not("installment_no", "is", null),
        HISTORY_ERROR,
      ),
    setArchived: (id, archived) =>
      setArchived(supabase, "loans", id, archived, "No se pudo actualizar el préstamo"),
    async delete(id) {
      const { error } = await supabase.from("loans").delete().eq("id", id);
      check(error, "No se pudo eliminar el préstamo");
    },
    async create(fields) {
      const { data, error } = await supabase.from("loans").insert(fields).select("id").single();
      check(error, "No se pudo guardar el préstamo");
      return { id: data!.id as string };
    },
    async rename(id, fields) {
      const { error } = await supabase.from("loans").update(fields).eq("id", id);
      check(error, "No se pudo actualizar el préstamo");
    },
    async paidInstallments(id) {
      const { data, error } = await loanPayments(id);
      check(error, "No se pudieron leer los pagos del préstamo");
      return (data ?? []).map((r) => Number(r.installment_no));
    },
    async paymentOf(id, no) {
      const { data, error } = await loanPayments(id).eq("installment_no", no).maybeSingle();
      check(error, "No se pudo leer el pago de la cuota");
      return (data?.id as string | undefined) ?? null;
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
    async loanIdOf(id) {
      const { data } = await supabase
        .from("transactions")
        .select("loan_id")
        .eq("id", id)
        .maybeSingle();
      return data?.loan_id ?? null;
    },
    async debitCardOf(id) {
      const { data } = await supabase
        .from("transactions")
        .select("debit_card_id")
        .eq("id", id)
        .maybeSingle();
      return data?.debit_card_id ?? null;
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
      // L3: el índice único de cuotas de préstamo choca si se paga dos veces.
      if (error?.code === UNIQUE_VIOLATION && movement.loan_id) {
        throw new InfrastructureError("Esa cuota ya está pagada");
      }
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
      // (supabase/Versionamiento/2.3.0/00_financing_interest.sql).
      const { data, error } = await supabase.rpc("create_financing_v3", {
        p_card_id: plan.card_id,
        p_description: plan.description,
        p_category: plan.category,
        p_principal: plan.total_amount,
        p_annual_rate: plan.annual_rate,
        p_months: plan.months,
        p_first_charge_on: plan.first_charge_on,
        p_installments: installments.map((c) => ({
          no: c.no,
          occurred_on: c.occurred_on,
          amount: c.amount,
          interest: c.interest,
        })),
      });
      check(error, "No se pudo crear el financiamiento.");
      return { id: data as string };
    },
    async find(id) {
      const { data } = await supabase
        .from("financings")
        .select("id, card_id, description, months, currency, cancelled_on")
        .eq("id", id)
        .eq("archived", false)
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id as string,
        card_id: data.card_id as string,
        description: data.description as string,
        months: Number(data.months),
        currency: isCurrency(String(data.currency)) ? (data.currency as Currency) : "CRC",
        cancelled_on: (data.cancelled_on as string | null) ?? null,
      };
    },
    async cardIdOf(id) {
      const { data } = await supabase
        .from("financings")
        .select("card_id")
        .eq("id", id)
        .maybeSingle();
      return data?.card_id ?? null;
    },
    async update(id, fields) {
      // supabase/Versionamiento/2.3.0/00_financing_interest.sql (plan + cuotas).
      const { error } = await supabase.rpc("update_financing", {
        p_financing_id: id,
        p_description: fields.description,
        p_category: fields.category,
      });
      check(error, "No se pudo actualizar el financiamiento");
    },
    async installments(id) {
      const { data, error } = await supabase
        .from("transactions")
        .select("installment_no, amount, occurred_on")
        .eq("financing_id", id)
        .eq("archived", false)
        .order("installment_no");
      check(error, "No se pudieron leer las cuotas");
      return (data ?? []).map((r) => ({
        no: Number(r.installment_no),
        amount: Number(r.amount),
        occurred_on: r.occurred_on as string,
      }));
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
    async shares(id) {
      const { data, error } = await supabase
        .from("financing_shares")
        .select("member_id, amount")
        .eq("financing_id", id)
        .eq("archived", false);
      check(error, "No se pudo leer el reparto");
      return (data ?? []).map((r) => ({ member_id: r.member_id as string, amount: Number(r.amount) }));
    },
    async replaceShares(id, shares) {
      // Sin transacción: se borran las que salen y se insertan/actualizan las
      // demás (upsert por financiamiento + miembro), así nunca queda vacío a medias.
      const { data: current, error: e1 } = await supabase
        .from("financing_shares")
        .select("member_id")
        .eq("financing_id", id);
      check(e1, "No se pudo leer el reparto");
      const keep = new Set(shares.map((s) => s.member_id));
      const gone = (current ?? []).map((r) => r.member_id as string).filter((m) => !keep.has(m));
      if (gone.length > 0) {
        const { error } = await supabase
          .from("financing_shares")
          .delete()
          .eq("financing_id", id)
          .in("member_id", gone);
        check(error, "No se pudo guardar el reparto");
      }
      if (shares.length > 0) {
        const { error } = await supabase.from("financing_shares").upsert(
          shares.map((s) => ({ financing_id: id, member_id: s.member_id, amount: s.amount, archived: false })),
          { onConflict: "financing_id,member_id" },
        );
        check(error, "No se pudo guardar el reparto");
      }
    },
  };

  const MEMBER_COLUMNS = "id, name, email, phone, archived";
  const members: MemberRepository = {
    async find(id) {
      const { data } = await supabase.from("members").select(MEMBER_COLUMNS).eq("id", id).maybeSingle();
      return (data as Member | null) ?? null;
    },
    // G5: partes en financiamientos, reembolsos y gastos compartidos (3.0.1).
    async historyCount(id) {
      const [shares, reimbursements, sharedParts] = await Promise.all([
        count(
          supabase
            .from("financing_shares")
            .select("id", { count: "exact", head: true })
            .eq("member_id", id),
          HISTORY_ERROR,
        ),
        count(
          supabase
            .from("member_reimbursements")
            .select("id", { count: "exact", head: true })
            .eq("member_id", id),
          HISTORY_ERROR,
        ),
        // Sin el SQL 3.0.1 la tabla no existe: no suma historia.
        Promise.resolve(
          supabase
            .from("shared_expense_parts")
            .select("id", { count: "exact", head: true })
            .eq("member_id", id),
        ).then(({ count: n }) => n ?? 0),
      ]);
      return shares + reimbursements + sharedParts;
    },
    async setArchived(id, archived) {
      const { error } = await supabase.from("members").update({ archived }).eq("id", id);
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Ya hay un miembro activo con ese nombre");
      }
      check(error, "No se pudo actualizar el miembro");
    },
    async save(id, fields) {
      const { data, error } = id
        ? await supabase.from("members").update(fields).eq("id", id).select("id").single()
        : await supabase.from("members").insert(fields).select("id").single();
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Ya existe un miembro con ese nombre");
      }
      check(error, "No se pudo guardar el miembro");
      return { id: data!.id as string };
    },
    async delete(id) {
      const { error } = await supabase.from("members").delete().eq("id", id);
      check(error, "No se pudo eliminar el miembro");
    },
  };

  const reimbursements: ReimbursementRepository = {
    async create(r) {
      const { data, error } = await supabase
        .from("member_reimbursements")
        .insert(r)
        .select("id")
        .single();
      if (error?.code === UNIQUE_VIOLATION) {
        throw new InfrastructureError("Esa parte ya está reembolsada");
      }
      check(error, "No se pudo registrar el reembolso");
      return { id: data!.id as string };
    },
    async membersWithReimbursements(financingId) {
      const { data, error } = await supabase
        .from("member_reimbursements")
        .select("member_id")
        .eq("financing_id", financingId);
      check(error, "No se pudieron leer los reembolsos");
      return [...new Set((data ?? []).map((r) => r.member_id as string))];
    },
    async delete(id) {
      const { data, error } = await supabase
        .from("member_reimbursements")
        .delete()
        .eq("id", id)
        .select("financing_id")
        .maybeSingle();
      check(error, "No se pudo deshacer el reembolso");
      return (data?.financing_id as string | undefined) ?? null;
    },
  };

  const notices: NoticeRepository = {
    async record(items) {
      const { error } = await supabase.from("member_notices").insert(items);
      check(error, "No se pudo registrar el aviso");
    },
  };

  /** Correo desde el Gmail conectado del usuario (F8). */
  const RECONNECT = "Reconectá Gmail en Ajustes → Bancos para permitir enviar avisos";
  const mailer: Mailer = {
    async send(mail) {
      const { data: conn } = await supabase
        .from("mail_connections")
        .select("refresh_token_enc, scopes")
        .eq("provider", "gmail")
        .maybeSingle();
      if (!conn) throw new InfrastructureError("Conectá Gmail en Ajustes → Bancos para enviar avisos por correo");
      if (!String(conn.scopes ?? "").includes(SEND_SCOPE)) throw new InfrastructureError(RECONNECT);
      try {
        const token = await refreshAccessToken(decryptToken(conn.refresh_token_enc as string));
        await sendMessage(token, mail);
      } catch (e) {
        if (e instanceof GmailPermissionError) throw new InfrastructureError(RECONNECT);
        throw new InfrastructureError("No se pudo enviar el correo");
      }
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
          .select("type, amount, currency, account_id, card_id, to_account_id, account_amount, archived")
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

  const freshStart: FreshStartRepository = {
    async activeProducts() {
      const [{ data: acc, error: e1 }, { data: crd, error: e2 }] = await Promise.all([
        supabase.from("accounts").select("id, name, currency").eq("archived", false),
        supabase.from("credit_cards").select("id, name").eq("archived", false),
      ]);
      check(e1 ?? e2, "No se pudieron leer las cuentas y tarjetas");
      return [
        ...(acc ?? []).map((a) => ({
          kind: "account" as const,
          id: a.id as string,
          name: a.name as string,
          currencies: [isCurrency(String(a.currency)) ? (a.currency as Currency) : "CRC"],
        })),
        // T1: una tarjeta lleva saldo en CRC y en USD.
        ...(crd ?? []).map((c) => ({
          kind: "card" as const,
          id: c.id as string,
          name: c.name as string,
          currencies: ["CRC", "USD"] as Currency[],
        })),
      ];
    },
    async run(todayISO, on, openings) {
      // supabase/Versionamiento/2.2.0/00_fresh_start.sql (atómico).
      const { data, error } = await supabase.rpc("fresh_start", {
        p_today: todayISO,
        p_on: on,
        p_openings: openings.map((o) =>
          o.kind === "account"
            ? { account_id: o.id, amount: o.amount }
            : { card_id: o.id, currency: o.currency, amount: o.amount },
        ),
      });
      check(error, "No se pudo completar el arranque de 0");
      return Number(data) || 0;
    },
  };

  // T8 (3.0.1): pago mínimo por corte y moneda.
  const minimumPayments: MinimumPaymentRepository = {
    async save(m) {
      const { error } = await supabase
        .from("card_minimum_payments")
        .upsert(m, { onConflict: "card_id,cutoff_on,currency" });
      check(error, "No se pudo guardar el pago mínimo (¿corriste el SQL 3.0.1?)");
    },
    async delete(key) {
      const { error } = await supabase
        .from("card_minimum_payments")
        .delete()
        .eq("card_id", key.card_id)
        .eq("cutoff_on", key.cutoff_on)
        .eq("currency", key.currency);
      check(error, "No se pudo borrar el pago mínimo");
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
    debitCards,
    categories,
    banks,
    loans,
    movements,
    financings,
    members,
    reimbursements,
    notices,
    mailer,
    pending,
    merchantRules,
    balances,
    exchangeRates,
    exchangeRateSource: haciendaExchangeRate,
    minimumPayments,
    freshStart,
    ...supabaseAccount(supabase),
    ...supabasePlans(supabase),
    ...supabaseSharedExpenses(supabase),
    ...supabaseConstellation(supabase),
  };
}

export type Repositories = ReturnType<typeof supabaseRepositories>;
