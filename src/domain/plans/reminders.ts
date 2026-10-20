/**
 * P8 (3.1.0): recordatorios dentro de la app. No se envía nada solo: el
 * Resumen junta lo que pide atención pronto (cobros de planes, montos por
 * confirmar, avisos de cobro por enviar y pagos mínimos por cubrir).
 */

import { daysUntil, fromISODate, type ISODate } from "../shared/calendar.ts";
import type { Currency } from "../shared/money.ts";

/** Días hacia adelante que cubre un recordatorio de plan. */
export const REMINDER_DAYS = 3;

export type ReminderKind = "plan" | "confirm" | "notice" | "minimum";

export type Reminder = {
  kind: ReminderKind;
  title: string;
  /** Fecha a la que se refiere (para ordenar), si hay. */
  on: ISODate | null;
  amount: number | null;
  currency: Currency | null;
  href: string;
};

export type ReminderInput = {
  todayISO: ISODate;
  /** Próximas ocurrencias de planes activos. */
  upcoming: { name: string; kind: "salary" | "subscription" | "insurance"; date: ISODate; amount: number; currency: Currency }[];
  /** Ocurrencias con monto estimado (P7). */
  toConfirm: number;
  /** Avisos de cobro por enviar (F8/X5). */
  noticesToSend: number;
  /** Pagos mínimos sin cubrir (T8). */
  minimums: { card: string; remaining: number; currency: Currency; dueOn: ISODate }[];
  days?: number;
};

/** P8: lista de recordatorios, de lo más urgente a lo menos. */
export function buildReminders(input: ReminderInput): Reminder[] {
  const days = input.days ?? REMINDER_DAYS;
  const today = fromISODate(input.todayISO);
  const out: Reminder[] = [];

  if (input.toConfirm > 0) {
    out.push({
      kind: "confirm",
      title: `${input.toConfirm} monto${input.toConfirm === 1 ? "" : "s"} variable${input.toConfirm === 1 ? "" : "s"} por confirmar`,
      on: null,
      amount: null,
      currency: null,
      href: "/procesos/planes",
    });
  }
  if (input.noticesToSend > 0) {
    out.push({
      kind: "notice",
      title: `${input.noticesToSend} aviso${input.noticesToSend === 1 ? "" : "s"} de cobro por enviar`,
      on: null,
      amount: null,
      currency: null,
      href: "/procesos/cobros",
    });
  }
  for (const m of input.minimums) {
    if (m.remaining <= 0) continue;
    const left = daysUntil(fromISODate(m.dueOn), today);
    if (left > days) continue;
    out.push({
      kind: "minimum",
      title: `Pago mínimo de ${m.card}`,
      on: m.dueOn,
      amount: m.remaining,
      currency: m.currency,
      href: "/procesos/tarjetas",
    });
  }
  for (const u of input.upcoming) {
    const left = daysUntil(fromISODate(u.date), today);
    if (left < 0 || left > days) continue;
    out.push({
      kind: "plan",
      title: u.kind === "salary" ? `Entra ${u.name}` : `Se cobra ${u.name}`,
      on: u.date,
      amount: u.amount,
      currency: u.currency,
      href: "/procesos/planes",
    });
  }
  return out.sort((a, b) => (a.on ?? "").localeCompare(b.on ?? ""));
}
