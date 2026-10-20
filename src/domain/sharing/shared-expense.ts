/**
 * Gastos compartidos (3.1.0, X1–X6). Un gasto que el usuario paga completo y
 * divide entre N personas (miembros): cada una tiene una parte fija, el
 * usuario se queda con el resto, y se lleva el control de avisos y cobros.
 *
 * - X1: el gasto es un movimiento `expense` normal: afecta los saldos por el
 *   total. Compartirlo no cambia el movimiento.
 * - X2: partes por persona (> 0, una vez cada una, en la moneda del gasto);
 *   la suma no pasa el total. Se sugieren partes iguales.
 * - X3: fecha límite de cobro: con tarjeta de crédito, la fecha de pago del
 *   estado de cuenta en que cae el cargo; si no, la que digita el usuario.
 * - X4: una parte se marca pagada una vez (fecha, medio y, si se quiere, un
 *   ingreso a una cuenta).
 * - X5: avisos como F8 pero desde el primer día (más de 3 quincenas = tramo 4).
 * - X6: no se quita ni se cambia la parte de quien ya pagó; no se deja de
 *   compartir un gasto con pagos registrados.
 */

import { DomainError } from "../shared/errors.ts";
import { addDays, fromISODate, toISODate, type ISODate } from "../shared/calendar.ts";
import { fromCents, moneyFromCents, splitEvenly, toCents, type Currency } from "../shared/money.ts";
import { groupNotices, type GroupedNotice } from "../shared/notices.ts";
import type { CardCycle } from "../cards/statement.ts";
import { chargeDueDate, quincenasLeft } from "../financing/members.ts";

export type SharedShare = { member_id: string; amount: number };

/** Medios con los que una persona paga su parte (mismos que los reembolsos F7). */
export const SHARED_PAYMENT_CHANNELS = ["sinpe", "efectivo", "transferencia", "otro"] as const;
export type SharedPaymentChannel = (typeof SHARED_PAYMENT_CHANNELS)[number];

/** Días que se dan por defecto para cobrar un gasto que no es de tarjeta (X3). */
export const SHARED_DEFAULT_DAYS = 15;

/** Tramo de aviso "más de 3 quincenas" (X5): se puede avisar desde el día 1. */
export const SHARED_FAR_BUCKET = 4;

/**
 * X2: partes iguales entre las personas (y el usuario si `includeMe`). El
 * residuo de céntimos va a la última parte: la del usuario si participa, si
 * no la de la última persona. Devuelve solo las partes de las personas.
 */
export function suggestSplit(total: number, memberIds: string[], includeMe: boolean): SharedShare[] {
  if (memberIds.length === 0 || !(total > 0)) return memberIds.map((member_id) => ({ member_id, amount: 0 }));
  const parts = splitEvenly(moneyFromCents(toCents(total), "CRC"), memberIds.length + (includeMe ? 1 : 0));
  return memberIds.map((member_id, i) => ({ member_id, amount: fromCents(parts[i].cents) }));
}

/** X2: valida las partes y devuelve la del usuario (el resto). */
export function validateSharedParts(total: number, shares: SharedShare[]): { own: number } {
  if (!(toCents(total) > 0)) throw new DomainError("X2", "El gasto debe ser mayor que 0");
  if (shares.length === 0) throw new DomainError("X2", "Agrega al menos una persona");
  const seen = new Set<string>();
  let cents = 0;
  for (const s of shares) {
    if (seen.has(s.member_id)) throw new DomainError("X2", "Una persona aparece dos veces");
    seen.add(s.member_id);
    if (!(toCents(s.amount) > 0)) throw new DomainError("X2", "La parte de cada persona debe ser mayor que 0");
    cents += toCents(s.amount);
  }
  if (cents > toCents(total)) {
    throw new DomainError(
      "X2",
      `Las partes (${fromCents(cents)}) pasan el total del gasto (${fromCents(toCents(total))})`,
    );
  }
  return { own: fromCents(toCents(total) - cents) };
}

/** Fecha sugerida para cobrar un gasto que no es de tarjeta. */
export function defaultSharedDueDate(occurredOn: ISODate): ISODate {
  return toISODate(addDays(fromISODate(occurredOn), SHARED_DEFAULT_DAYS));
}

/**
 * X3: con tarjeta de crédito, la fecha de pago del estado de cuenta en que cae
 * el cargo (respeta T3: si la tarjeta pasa el día de corte al siguiente, un
 * cargo de ese día cae en el corte siguiente). Sin tarjeta, la fecha elegida,
 * que no puede ser anterior al gasto.
 */
export function sharedDueDate(input: {
  occurred_on: ISODate;
  card: CardCycle | null;
  chosen: ISODate | null;
}): ISODate {
  if (input.card) return chargeDueDate(input.card, input.occurred_on);
  if (!input.chosen) throw new DomainError("X3", "Elige hasta cuándo te deben pagar");
  if (input.chosen < input.occurred_on) {
    throw new DomainError("X3", "La fecha de cobro no puede ser anterior al gasto");
  }
  return input.chosen;
}

/** Una parte guardada (con su pago, si lo hay). */
export type SharedPartState = SharedShare & {
  paid_on: ISODate | null;
};

/**
 * X6: al editar, cada persona que ya pagó sigue en el reparto con el mismo
 * monto (primero se deshace el pago).
 */
export function assertKeepsPaidParts(before: SharedPartState[], after: SharedShare[]): void {
  for (const p of before) {
    if (!p.paid_on) continue;
    const next = after.find((s) => s.member_id === p.member_id);
    if (!next || toCents(next.amount) !== toCents(p.amount)) {
      throw new DomainError("X6", "No se cambia ni se quita la parte de quien ya pagó: primero deshaz su pago");
    }
  }
}

/** X6: no se deja de compartir un gasto con pagos registrados. */
export function assertCanUnshare(parts: SharedPartState[]): void {
  if (parts.some((p) => p.paid_on)) {
    throw new DomainError("X6", "Este gasto ya tiene pagos registrados: deshazlos antes de dejar de compartirlo");
  }
}

/** Una parte lista para mostrar, avisar y cobrar. */
export type SharedPart = SharedPartState & {
  shared_expense_id: string;
  currency: Currency;
  /** Fecha del gasto. */
  occurred_on: ISODate;
  /** Fecha límite de cobro (X3). */
  due_on: ISODate;
};

export type SharedSentNotice = {
  shared_expense_id: string;
  member_id: string;
  quincenas: number;
  sent_at: string;
};

/** X5: tramo de una parte: 0 venció, 1–3 quincenas, 4 = más de 3 (se avisa igual). */
export function sharedNoticeBucket(dueISO: ISODate, todayISO: ISODate): number {
  return Math.min(SHARED_FAR_BUCKET, quincenasLeft(dueISO, todayISO));
}

export type SharedNoticeGroup = GroupedNotice<SharedPart & { paid: boolean }>;

/** X5: avisos por persona + fecha límite + moneda, una vez por tramo. */
export function sharedNoticeGroups(
  parts: SharedPart[],
  sent: SharedSentNotice[],
  todayISO: ISODate,
): SharedNoticeGroup[] {
  return groupNotices(
    parts.map((p) => ({ ...p, paid: Boolean(p.paid_on) })),
    (p) => sharedNoticeBucket(p.due_on, todayISO),
    (p) => sent.filter((n) => n.shared_expense_id === p.shared_expense_id && n.member_id === p.member_id),
  );
}

export type SharedReceivable = { member_id: string; currency: Currency; total: number; parts: SharedPart[] };

/** Lo que cada persona debe de gastos ya ocurridos (fecha ≤ hoy), por moneda. */
export function sharedReceivables(parts: SharedPart[], todayISO: ISODate): SharedReceivable[] {
  const out = new Map<string, SharedReceivable>();
  for (const p of parts) {
    if (p.paid_on || p.occurred_on > todayISO) continue;
    const key = `${p.member_id}:${p.currency}`;
    const r = out.get(key) ?? { member_id: p.member_id, currency: p.currency, total: 0, parts: [] };
    r.parts.push(p);
    r.total = fromCents(toCents(r.total) + toCents(p.amount));
    out.set(key, r);
  }
  return [...out.values()];
}

export type PercentShare = { member_id: string; percent: number };

/**
 * X7 (3.1.0): reparto por **porcentaje**. Cada porcentaje es > 0 y la suma no
 * pasa 100 %; el resto es del usuario. Se convierte a montos (lo que se
 * guarda, X2): cada parte se redondea hacia abajo a céntimos y los céntimos
 * que sobran quedan en la parte del usuario.
 */
export function splitByPercent(total: number, shares: PercentShare[]): SharedShare[] {
  const seen = new Set<string>();
  let sum = 0;
  for (const s of shares) {
    if (seen.has(s.member_id)) throw new DomainError("X7", "Una persona aparece dos veces");
    seen.add(s.member_id);
    if (!(Number.isFinite(s.percent) && s.percent > 0)) {
      throw new DomainError("X7", "El porcentaje de cada persona debe ser mayor que 0");
    }
    sum += s.percent;
  }
  if (sum > 100 + 1e-9) throw new DomainError("X7", `Los porcentajes suman ${Math.round(sum * 100) / 100} %: no pueden pasar 100 %`);
  const totalCents = toCents(total);
  return shares.map((s) => ({ member_id: s.member_id, amount: fromCents(Math.floor((totalCents * s.percent) / 100)) }));
}

/** X7: porcentajes iguales sugeridos (el usuario cuenta como una parte si participa). */
export function suggestPercents(memberIds: string[], includeMe: boolean): PercentShare[] {
  const n = memberIds.length + (includeMe ? 1 : 0);
  if (n === 0) return [];
  const each = Math.floor(10000 / n) / 100; // dos decimales, hacia abajo
  return memberIds.map((member_id) => ({ member_id, percent: each }));
}
