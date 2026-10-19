/**
 * Miembros de la familia que pagan parte de un financiamiento (F6–F8).
 *
 * - F6: cada miembro tiene un **monto fijo por cuota**; la parte del usuario
 *   es lo que sobra, así las partes suman exactamente la cuota. La suma de
 *   los miembros no puede pasar la cuota más baja del plan.
 * - F7: un reembolso registra que un miembro pagó su parte de una cuota. Es
 *   un control interno: no toca la tarjeta ni las cuentas.
 * - F8: el aviso de cuota le dice a cada miembro su parte y cuántas
 *   quincenas (1, 2 o 3) faltan para la fecha límite de pago de la tarjeta.
 */

import { DomainError } from "../shared/errors.ts";
import { daysUntil, fromISODate, toISODate, type ISODate } from "../shared/calendar.ts";
import { fromCents, toCents, type Currency } from "../shared/money.ts";
import { groupNotices } from "../shared/notices.ts";
import {
  nextCutoffDate,
  paymentDueForCutoff,
  type CardCycle,
} from "../cards/statement.ts";

export type MemberShare = { member_id: string; amount: number };

/** F6: montos > 0, un miembro una sola vez y la suma ≤ la cuota más baja. */
export function validateShares(
  shares: MemberShare[],
  installments: { amount: number }[],
): void {
  const seen = new Set<string>();
  let totalCents = 0;
  for (const s of shares) {
    if (seen.has(s.member_id)) {
      throw new DomainError("F6", "Un miembro aparece dos veces en el reparto");
    }
    seen.add(s.member_id);
    if (!(toCents(s.amount) > 0)) {
      throw new DomainError("F6", "La parte de cada miembro debe ser mayor que 0");
    }
    totalCents += toCents(s.amount);
  }
  if (shares.length === 0 || installments.length === 0) return;
  const minCents = Math.min(...installments.map((c) => toCents(c.amount)));
  if (totalCents > minCents) {
    throw new DomainError(
      "F6",
      `Las partes de los miembros (${fromCents(totalCents)}) pasan la cuota más baja (${fromCents(minCents)})`,
    );
  }
}

/** F6: partes de una cuota; la del usuario es el resto. */
export function installmentParts(
  amount: number,
  shares: MemberShare[],
): { members: MemberShare[]; own: number } {
  const membersCents = shares.reduce((s, m) => s + toCents(m.amount), 0);
  return { members: shares, own: fromCents(toCents(amount) - membersCents) };
}

/** Fecha límite de pago del estado de cuenta en el que cae un cargo. */
export function chargeDueDate(cycle: CardCycle, occurredOn: ISODate): ISODate {
  const cutoff = nextCutoffDate(cycle.cutoff_day, fromISODate(occurredOn));
  return toISODate(paymentDueForCutoff(cutoff, cycle.cutoff_day, cycle.payment_due_day));
}

export const NOTICE_QUINCENAS = 3;

/**
 * F8: quincenas que faltan para una fecha límite: 1 (≤ 15 días, incluido el
 * mismo día), 2 o 3; más de 45 días = 4+ (todavía no se avisa); 0 = venció.
 */
export function quincenasLeft(dueISO: ISODate, todayISO: ISODate): number {
  const days = daysUntil(fromISODate(dueISO), fromISODate(todayISO));
  if (days < 0) return 0;
  return Math.max(1, Math.ceil(days / 15));
}

export type MemberPart = {
  financing_id: string;
  installment_no: number;
  member_id: string;
  amount: number;
  currency: Currency;
  /** Fecha de la cuota en la tarjeta. */
  occurred_on: ISODate;
  /** Fecha límite de pago del estado de cuenta de esa cuota. */
  due_on: ISODate;
  reimbursement: { id: string; paid_on: ISODate; amount: number } | null;
};

export type ShareablePlan = {
  id: string;
  currency?: Currency;
  cycle: CardCycle;
  installments: { no: number; occurred_on: ISODate }[];
  shares: MemberShare[];
};

export type Reimbursement = {
  id: string;
  financing_id: string;
  member_id: string;
  installment_no: number;
  paid_on: ISODate;
  amount: number;
};

/** Todas las partes de los miembros, cuota por cuota, con su reembolso si lo hay. */
export function memberParts(plans: ShareablePlan[], reimbursements: Reimbursement[]): MemberPart[] {
  const paid = new Map(
    reimbursements.map((r) => [`${r.financing_id}:${r.member_id}:${r.installment_no}`, r]),
  );
  return plans.flatMap((plan) =>
    plan.installments.flatMap((c) => {
      const due_on = chargeDueDate(plan.cycle, c.occurred_on);
      return plan.shares.map((s) => {
        const r = paid.get(`${plan.id}:${s.member_id}:${c.no}`);
        return {
          financing_id: plan.id,
          installment_no: c.no,
          member_id: s.member_id,
          amount: s.amount,
          currency: plan.currency ?? "CRC",
          occurred_on: c.occurred_on,
          due_on,
          reimbursement: r ? { id: r.id, paid_on: r.paid_on, amount: r.amount } : null,
        };
      });
    }),
  );
}

export type SentNotice = {
  financing_id: string;
  member_id: string;
  installment_no: number;
  quincenas: number;
  sent_at: string;
};

export type NoticeGroup = {
  member_id: string;
  due_on: ISODate;
  currency: Currency;
  /** 1, 2 o 3 quincenas; 0 = la fecha límite ya pasó. */
  quincenas: number;
  parts: MemberPart[];
  total: number;
  /** F8: falta avisar en esta quincena (algún aviso de la quincena no se envió). */
  needsNotice: boolean;
  /** Último aviso enviado sobre estas partes, si hay. */
  lastSentAt: string | null;
};

/**
 * F8: partes sin reembolsar cuya fecha límite cae dentro de 3 quincenas (o ya
 * venció), agrupadas por miembro, fecha límite y moneda: un solo mensaje por
 * miembro y fecha. Se avisa una vez por quincena (3, 2, 1 y al vencer).
 */
export function noticeGroups(
  parts: MemberPart[],
  sent: SentNotice[],
  todayISO: ISODate,
): NoticeGroup[] {
  return groupNotices(
    parts.map((p) => ({ ...p, paid: Boolean(p.reimbursement) })),
    (p) => {
      const q = quincenasLeft(p.due_on, todayISO);
      return q > NOTICE_QUINCENAS ? null : q;
    },
    (p) =>
      sent.filter(
        (n) =>
          n.financing_id === p.financing_id &&
          n.member_id === p.member_id &&
          n.installment_no === p.installment_no,
      ),
  );
}

export type Receivable = { member_id: string; currency: Currency; total: number; parts: MemberPart[] };

/** Lo que cada miembro debe de cuotas ya cobradas en la tarjeta (fecha ≤ hoy), por moneda. */
export function memberReceivables(parts: MemberPart[], todayISO: ISODate): Receivable[] {
  const out = new Map<string, Receivable>();
  for (const p of parts) {
    if (p.reimbursement || p.occurred_on > todayISO) continue;
    const key = `${p.member_id}:${p.currency}`;
    const r = out.get(key) ?? { member_id: p.member_id, currency: p.currency, total: 0, parts: [] };
    r.parts.push(p);
    r.total = fromCents(toCents(r.total) + toCents(p.amount));
    out.set(key, r);
  }
  return [...out.values()];
}
