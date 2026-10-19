/**
 * Ahorros y metas (2.7.0). Una meta tiene un objetivo (monto, moneda y fecha
 * opcional) y se liga a una cuenta: lo ahorrado es el saldo de esa cuenta y
 * los aportes son transferencias hacia ella. Reglas A1–A3.
 */

import { fromISODate, type ISODate } from "../shared/calendar.ts";
import { DomainError } from "../shared/errors.ts";
import { fromCents, toCents } from "../shared/money.ts";

export type GoalTerms = {
  name: string;
  targetAmount: number;
  targetDate: ISODate | null;
};

/** A2: nombre, objetivo mayor que cero y, si hay fecha, posterior a hoy al crear. */
export function validateGoal(g: GoalTerms, today: ISODate, creating: boolean): void {
  if (!g.name.trim()) throw new DomainError("A2", "La meta necesita un nombre");
  if (!(g.targetAmount > 0) || !Number.isFinite(g.targetAmount)) {
    throw new DomainError("A2", "El objetivo debe ser mayor que cero");
  }
  if (creating && g.targetDate && g.targetDate <= today) {
    throw new DomainError("A2", "La fecha de la meta debe ser futura");
  }
}

export type GoalStatus = "lograda" | "en-camino" | "atrasada" | "sin-fecha";

export type GoalProgress = {
  saved: number;
  remaining: number;
  /** 0..1 */
  ratio: number;
  /** Meses que faltan hasta la fecha (con fracción hacia arriba), o null. */
  monthsLeft: number | null;
  /** Aporte mensual para llegar a tiempo, o null. */
  monthlyNeeded: number | null;
  status: GoalStatus;
};

function monthsBetween(from: ISODate, to: ISODate): number {
  const a = fromISODate(from);
  const b = fromISODate(to);
  const whole = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(0, whole + (b.getDate() > a.getDate() ? 1 : 0));
}

/**
 * A3: avance de una meta. Lo ahorrado no baja de 0 para el avance (una cuenta
 * en negativo no "debe" a la meta). Atrasada = la fecha pasó sin llegar.
 */
export function goalProgress(input: {
  targetAmount: number;
  saved: number;
  targetDate: ISODate | null;
  today: ISODate;
}): GoalProgress {
  const savedCents = Math.max(0, toCents(input.saved));
  const targetCents = toCents(input.targetAmount);
  const remainingCents = Math.max(0, targetCents - savedCents);
  const ratio = targetCents > 0 ? Math.min(1, savedCents / targetCents) : 0;

  if (remainingCents === 0) {
    return {
      saved: fromCents(savedCents),
      remaining: 0,
      ratio: 1,
      monthsLeft: input.targetDate ? monthsBetween(input.today, input.targetDate) : null,
      monthlyNeeded: 0,
      status: "lograda",
    };
  }
  if (!input.targetDate) {
    return {
      saved: fromCents(savedCents),
      remaining: fromCents(remainingCents),
      ratio,
      monthsLeft: null,
      monthlyNeeded: null,
      status: "sin-fecha",
    };
  }
  const monthsLeft = monthsBetween(input.today, input.targetDate);
  const late = input.targetDate < input.today;
  return {
    saved: fromCents(savedCents),
    remaining: fromCents(remainingCents),
    ratio,
    monthsLeft,
    monthlyNeeded: late || monthsLeft === 0 ? fromCents(remainingCents) : fromCents(Math.ceil(remainingCents / monthsLeft)),
    status: late ? "atrasada" : "en-camino",
  };
}
