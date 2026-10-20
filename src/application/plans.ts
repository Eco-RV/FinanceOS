/**
 * Casos de uso de planes recurrentes y metas de ahorro (2.7.0). Los planes
 * registran cada ocurrencia cuando llega su fecha (`syncPlans`, M7); las
 * futuras las calcula el dominio para mostrarlas.
 */

import {
  assertCategoryUsable,
  assertDebitCardUsable,
  assertSameCurrency,
  DomainError,
  dueOccurrences,
  fromISODate,
  PLAN_DEFAULT_CATEGORY,
  suggestFixedCategory,
  toISODate,
  validateBaselineCap,
  validateGoal,
  validatePlan,
  type ISODate,
} from "../domain/index.ts";
import type {
  AccountRepository,
  CardRepository,
  CategoryRepository,
  DebitCardRepository,
  GoalFields,
  GoalRepository,
  NewMovement,
  Plan,
  PlanFields,
  PlanRepository,
  ProfileRepository,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

export type PlanDeps = {
  plans: PlanRepository;
  accounts: AccountRepository;
  cards: CardRepository;
  categories: CategoryRepository;
  /** Solo hace falta para planes con tarjeta de débito (2.8.0). */
  debitCards?: DebitCardRepository;
};

const NOT_FOUND = "Plan no encontrado";

function dayBefore(iso: ISODate): ISODate {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
}

function termsOf(f: PlanFields) {
  return {
    kind: f.kind,
    amount: f.amount,
    currency: f.currency,
    frequency: f.frequency,
    startsOn: f.starts_on,
    endsOn: f.ends_on,
    accountId: f.account_id,
    cardId: f.card_id,
    debitCardId: f.debit_card_id ?? null,
  };
}

/** P1/P2/T9 + destino activo (G4) y en la moneda del plan (G3) si es cuenta. */
async function checkTarget(deps: PlanDeps, f: PlanFields): Promise<void> {
  if (f.account_id) {
    const currency = await deps.accounts.currencyOf(f.account_id);
    if (!currency) throw new DomainError("G4", "Cuenta no encontrada o desactivada");
    assertSameCurrency(currency, f.currency);
  }
  if (f.card_id) {
    // Tarjeta bimoneda (T1): el cargo puede ir en CRC o USD.
    if (!(await deps.cards.currencyOf(f.card_id))) {
      throw new DomainError("G4", "Tarjeta no encontrada o desactivada");
    }
  }
  if (f.debit_card_id) {
    // G4/C3: tarjeta de débito activa y de la cuenta del plan.
    const card = deps.debitCards ? await deps.debitCards.find(f.debit_card_id) : null;
    assertDebitCardUsable(card, f.account_id);
  }
}

/**
 * Crea o edita un plan. P6: uno nuevo registra desde hoy; las fechas
 * anteriores no se registran (esa plata ya está en los saldos). Editar
 * cambia las ocurrencias que vienen, no las ya registradas.
 */
export function savePlan(
  deps: PlanDeps,
  input: { id: string | null; fields: PlanFields; today: ISODate },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    const fields: PlanFields = {
      ...input.fields,
      debit_card_id: input.fields.kind !== "salary" ? (input.fields.debit_card_id ?? null) : null,
      name: input.fields.name.trim(),
      // Gasto fijo sin categoría: la sugerida por el nombre (Alquiler → Vivienda…).
      category:
        input.fields.category?.trim() ||
        (input.fields.kind === "subscription" ? suggestFixedCategory(input.fields.name) : null) ||
        PLAN_DEFAULT_CATEGORY[input.fields.kind],
    };
    validatePlan(termsOf(fields));
    await checkTarget(deps, fields);

    let previousCategory: string | null = null;
    if (input.id) {
      const current = await deps.plans.find(input.id);
      if (!current) return fail(NOT_FOUND);
      if (current.kind !== fields.kind) return fail("No se puede cambiar el tipo de un plan");
      previousCategory = current.category;
    }
    assertCategoryUsable({
      category: fields.category,
      deactivated: await deps.categories.isDeactivated(
        fields.kind === "salary" ? "income" : "expense",
        fields.category!,
      ),
      previous: previousCategory,
    });

    if (input.id) return ok(await deps.plans.save(input.id, fields));
    const generatedThrough = fields.starts_on <= input.today ? dayBefore(input.today) : null;
    return ok(await deps.plans.save(null, fields, generatedThrough));
  });
}

/** Movimiento de una ocurrencia del plan. */
export function occurrenceMovement(plan: Plan, date: ISODate): NewMovement {
  return {
    type: plan.kind === "salary" ? "income" : "expense",
    amount: plan.amount,
    currency: plan.currency,
    occurred_on: date,
    category: plan.category ?? PLAN_DEFAULT_CATEGORY[plan.kind],
    note: plan.note ? `${plan.name} · ${plan.note}` : plan.name,
    account_id: plan.account_id,
    card_id: plan.card_id,
    debit_card_id: plan.debit_card_id ?? null,
    plan_id: plan.id,
    // P7: un plan variable entra con el estimado y queda por confirmar.
    estimated: Boolean(plan.variable),
  };
}

/**
 * M7: registra las ocurrencias que ya llegaron de cada plan activo. Un plan
 * sin cuenta ni tarjeta (se borró) no registra nada. Idempotente.
 */
export function syncPlans(
  plans: PlanRepository,
  today: ISODate,
): Promise<UseCaseResult<{ registered: number }>> {
  return run(async () => {
    let registered = 0;
    for (const plan of await plans.list()) {
      if (plan.archived || (!plan.account_id && !plan.card_id)) continue;
      const due = dueOccurrences(
        { frequency: plan.frequency, startsOn: plan.starts_on, endsOn: plan.ends_on },
        plan.generated_through,
        today,
      );
      if (due.length === 0) continue;
      registered += await plans.materialize(
        plan.id,
        today,
        due.map((d) => occurrenceMovement(plan, d)),
      );
    }
    return ok({ registered });
  });
}

/** Pausar deja de registrar; reanudar vuelve a registrar desde hoy (no lo pausado). */
export function setPlanActive(
  plans: PlanRepository,
  input: { id: string; active: boolean; today: ISODate },
): Promise<UseCaseResult> {
  return run(async () => {
    const plan = await plans.find(input.id);
    if (!plan) return fail(NOT_FOUND);
    if (input.active) {
      const through = plan.generated_through && plan.generated_through >= input.today
        ? plan.generated_through
        : dayBefore(input.today);
      await plans.setArchived(input.id, false, through);
    } else {
      await plans.setArchived(input.id, true);
    }
    return ok();
  });
}

/** P3: elimina el plan; lo ya registrado se conserva y no hay cargos futuros. */
export function deletePlan(plans: PlanRepository, id: string): Promise<UseCaseResult> {
  return run(async () => {
    if (!(await plans.find(id))) return fail(NOT_FOUND);
    await plans.delete(id);
    return ok();
  });
}

/** P4: guarda el tope de la línea base en las preferencias. */
export function setBaselineCap(
  profiles: ProfileRepository,
  percent: number,
): Promise<UseCaseResult<{ percent: number }>> {
  return run(async () => {
    const value = validateBaselineCap(percent);
    await profiles.savePreferences({ baselineCapPercent: value });
    return ok({ percent: value });
  });
}

// ─────────────────────────────  metas de ahorro  ─────────────────────────────

const GOAL_NOT_FOUND = "Meta no encontrada";

/** A1–A2: crea o edita una meta; la cuenta ligada debe estar activa y en su moneda. */
export function saveGoal(
  deps: { goals: GoalRepository; accounts: AccountRepository },
  input: { id: string | null; fields: GoalFields; today: ISODate },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    const fields = { ...input.fields, name: input.fields.name.trim() };
    validateGoal(
      { name: fields.name, targetAmount: fields.target_amount, targetDate: fields.target_date },
      input.today,
      input.id === null,
    );
    if (input.id && !(await deps.goals.find(input.id))) return fail(GOAL_NOT_FOUND);
    if (fields.account_id) {
      const currency = await deps.accounts.currencyOf(fields.account_id);
      if (!currency) throw new DomainError("G4", "Cuenta no encontrada o desactivada");
      assertSameCurrency(currency, fields.currency, "A1");
    }
    return ok(await deps.goals.save(input.id, fields));
  });
}

export function setGoalArchived(
  goals: GoalRepository,
  input: { id: string; archived: boolean },
): Promise<UseCaseResult> {
  return run(async () => {
    if (!(await goals.find(input.id))) return fail(GOAL_NOT_FOUND);
    await goals.setArchived(input.id, input.archived);
    return ok();
  });
}

/** Eliminar una meta no toca la cuenta ni sus movimientos. */
export function deleteGoal(goals: GoalRepository, id: string): Promise<UseCaseResult> {
  return run(async () => {
    if (!(await goals.find(id))) return fail(GOAL_NOT_FOUND);
    await goals.delete(id);
    return ok();
  });
}

/**
 * P7 (3.0.1): confirma el monto real de una ocurrencia de un plan variable
 * (salario, luz…). El saldo lo ajusta la persistencia (trigger).
 */
export function confirmPlanOccurrence(
  plans: PlanRepository,
  input: { movement_id: string; amount: number },
): Promise<UseCaseResult> {
  return run(async () => {
    if (!(Number.isFinite(input.amount) && input.amount > 0)) {
      throw new DomainError("P5", "El monto debe ser mayor que cero");
    }
    const pending = await plans.estimatedOccurrences();
    if (!pending.some((o) => o.movement_id === input.movement_id)) {
      return fail("Ese movimiento ya no está por confirmar");
    }
    await plans.confirmOccurrence(input.movement_id, input.amount);
    return ok();
  });
}
