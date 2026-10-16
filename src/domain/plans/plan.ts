/**
 * Planes recurrentes (2.7.0): salario (P1), gasto fijo (P2: renta, servicios,
 * suscripciones…; en la base `kind = "subscription"`) y seguro de
 * tarjeta (T9). Un plan es un calendario de movimientos; cada ocurrencia se
 * registra cuando llega su fecha (M7: lo futuro no cuenta en los saldos de
 * hoy) y las futuras solo se calculan. Reglas P1–P5 y T9.
 */

import {
  dateInMonth,
  fromISODate,
  toISODate,
  type ISODate,
} from "../shared/calendar.ts";
import { DomainError } from "../shared/errors.ts";
import { fromCents, toCents, type Currency } from "../shared/money.ts";

export const PLAN_KINDS = ["salary", "subscription", "insurance"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const FREQUENCIES = ["weekly", "biweekly", "semimonthly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Categoría por defecto de cada tipo de plan. */
export const PLAN_DEFAULT_CATEGORY: Record<PlanKind, string> = {
  salary: "Salario",
  subscription: "Suscripciones",
  insurance: "Seguros",
};

export type PlanTerms = {
  kind: PlanKind;
  amount: number;
  currency: Currency;
  frequency: Frequency;
  /** Primera ocurrencia (y día de referencia para los planes mensuales). */
  startsOn: ISODate;
  endsOn: ISODate | null;
  /** Salario y suscripción con débito: cuenta; seguro y suscripción con crédito: tarjeta. */
  accountId: string | null;
  cardId: string | null;
};

/** P1, P2, T9, P5: forma de un plan. */
export function validatePlan(p: PlanTerms): void {
  if (!(p.amount > 0) || !Number.isFinite(p.amount)) {
    throw new DomainError("P5", "El monto debe ser mayor que cero");
  }
  if (p.endsOn && p.endsOn < p.startsOn) {
    throw new DomainError("P5", "La fecha final no puede ser anterior al inicio");
  }
  if (p.kind !== "salary" && p.frequency !== "monthly") {
    throw new DomainError("P2", "Los gastos fijos y los seguros son mensuales");
  }
  if (p.kind === "salary" && (!p.accountId || p.cardId)) {
    throw new DomainError("P1", "Un salario entra a una cuenta de débito");
  }
  if (p.kind === "insurance" && (!p.cardId || p.accountId)) {
    throw new DomainError("T9", "Un seguro se cobra a una tarjeta de crédito");
  }
  if (p.kind === "subscription" && Boolean(p.accountId) === Boolean(p.cardId)) {
    throw new DomainError("P2", "Un gasto fijo se paga con una tarjeta o desde una cuenta (una sola)");
  }
}

/**
 * Fechas del plan en (after, through], en orden. `after` = última fecha ya
 * registrada (o null: desde el inicio). Quincenal = días 15 y último del mes.
 */
export function occurrencesBetween(
  p: Pick<PlanTerms, "frequency" | "startsOn" | "endsOn">,
  after: ISODate | null,
  through: ISODate,
  limit = 400,
): ISODate[] {
  const end = p.endsOn && p.endsOn < through ? p.endsOn : through;
  const out: ISODate[] = [];
  const keep = (iso: ISODate) => iso >= p.startsOn && iso <= end && (after === null || iso > after);
  const start = fromISODate(p.startsOn);

  if (p.frequency === "weekly" || p.frequency === "biweekly") {
    const step = p.frequency === "weekly" ? 7 : 14;
    for (let i = 0; out.length < limit; i++) {
      const iso = toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * step));
      if (iso > end) break;
      if (keep(iso)) out.push(iso);
    }
    return out;
  }

  for (let i = 0; out.length < limit; i++) {
    const y = start.getFullYear();
    const m = start.getMonth() + i;
    const days =
      p.frequency === "monthly"
        ? [dateInMonth(y, m, start.getDate())]
        : // dateInMonth recorta el 31 al último día del mes.
          [dateInMonth(y, m, 15), dateInMonth(y, m, 31)];
    const isos = days.map(toISODate);
    if (isos[0] > end) break;
    for (const iso of isos) if (keep(iso)) out.push(iso);
  }
  return out;
}

/** Ocurrencias que ya llegaron (≤ hoy) y no se han registrado. */
export function dueOccurrences(
  p: Pick<PlanTerms, "frequency" | "startsOn" | "endsOn">,
  generatedThrough: ISODate | null,
  today: ISODate,
): ISODate[] {
  return occurrencesBetween(p, generatedThrough, today);
}

/** Próximas ocurrencias programadas (> hoy) hasta una fecha. */
export function upcomingOccurrences(
  p: Pick<PlanTerms, "frequency" | "startsOn" | "endsOn">,
  today: ISODate,
  until: ISODate,
): ISODate[] {
  return occurrencesBetween(p, today, until);
}

/** Veces por año de cada frecuencia. */
const PER_YEAR: Record<Frequency, number> = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };

/** Monto equivalente por mes (semanal ×52/12, bisemanal ×26/12, quincenal ×2). */
export function monthlyEquivalent(amount: number, frequency: Frequency): number {
  return fromCents(Math.round((toCents(amount) * PER_YEAR[frequency]) / 12));
}

export const DEFAULT_BASELINE_CAP = 35;

export type FixedCost = {
  name: string;
  /** "subscription" | "insurance" | "loan" | "financing" … (lo decide quien llama). */
  source: string;
  monthly: number;
};

export type BaselineItem = FixedCost & {
  /** Parte del ingreso mensual (0..∞); null sin salario. */
  share: number | null;
};

export type Baseline = {
  /** Ingreso mensual de los salarios. */
  monthlyIncome: number;
  monthlyFixed: number;
  items: BaselineItem[];
  /** Gastos fijos / ingreso (null sin salario). */
  ratio: number | null;
  capPercent: number;
  /** P4: los gastos fijos superan el tope. */
  overCap: boolean;
  /** Repartido por periodo, para controlar liquidez. */
  perPeriod: { week: number; fortnight: number; month: number };
};

/**
 * P4: línea base financiera de una moneda. Suma los gastos fijos mensuales y
 * los compara con el ingreso de los salarios; advierte si pasan el tope
 * (default 35 %).
 */
export function baseline(
  salaries: { amount: number; frequency: Frequency }[],
  fixed: FixedCost[],
  capPercent: number = DEFAULT_BASELINE_CAP,
): Baseline {
  const cents = (n: number) => toCents(n);
  const incomeCents = salaries.reduce((s, x) => s + cents(monthlyEquivalent(x.amount, x.frequency)), 0);
  const fixedCents = fixed.reduce((s, x) => s + cents(x.monthly), 0);
  const ratio = incomeCents > 0 ? fixedCents / incomeCents : null;
  const items = [...fixed]
    .sort((a, b) => b.monthly - a.monthly)
    .map((f) => ({ ...f, share: incomeCents > 0 ? cents(f.monthly) / incomeCents : null }));
  return {
    monthlyIncome: fromCents(incomeCents),
    monthlyFixed: fromCents(fixedCents),
    items,
    ratio,
    capPercent,
    overCap: ratio !== null && ratio * 100 > capPercent,
    perPeriod: {
      week: fromCents(Math.round((fixedCents * 12) / 52)),
      fortnight: fromCents(Math.round(fixedCents / 2)),
      month: fromCents(fixedCents),
    },
  };
}

/** P4: el tope es un porcentaje entre 1 y 100. */
export function validateBaselineCap(percent: number): number {
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
    throw new DomainError("P4", "El tope debe estar entre 1 % y 100 %");
  }
  return Math.round(percent * 10) / 10;
}

/** Palabras clave (sin tildes, minúsculas) → categoría sugerida de un gasto fijo. */
const FIXED_CATEGORY_HINTS: [RegExp, string][] = [
  [/alquiler|renta|hipoteca|condominio|vivienda|casa/, "Vivienda"],
  [/agua|luz|electric|internet|wifi|cable|telefono|celular|gas|basura|servicio/, "Servicios"],
  [/netflix|spotify|disney|hbo|max|prime|youtube|icloud|google|apple|suscrip|streaming/, "Suscripciones"],
  [/gimnasio|gym/, "Salud"],
  [/colegio|escuela|universidad|curso|matricula/, "Educación"],
];

/**
 * Gasto fijo (2.7.0, antes "suscripción"): categoría sugerida por el nombre
 * ("Alquiler" → Vivienda, "Luz" → Servicios, "Netflix" → Suscripciones).
 * `null` si no hay pista; el usuario siempre la puede cambiar.
 */
export function suggestFixedCategory(name: string): string | null {
  const n = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  for (const [re, category] of FIXED_CATEGORY_HINTS) if (re.test(n)) return category;
  return null;
}
