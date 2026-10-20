/**
 * Agrupado de avisos de cobro, común a las cuotas de financiamientos (F8) y a
 * los gastos compartidos (X5): las partes sin pagar de un miembro con la misma
 * fecha límite y moneda van en un solo aviso, y se avisa una vez por "tramo"
 * de quincenas.
 */

import type { ISODate } from "./calendar.ts";
import { fromCents, toCents, type Currency } from "./money.ts";

/** Lo mínimo que necesita una parte para agruparse en un aviso. */
export type NoticePart = {
  member_id: string;
  currency: Currency;
  amount: number;
  due_on: ISODate;
  paid: boolean;
};

export type GroupedNotice<P extends NoticePart> = {
  member_id: string;
  due_on: ISODate;
  currency: Currency;
  /** Tramo de quincenas del grupo (0 = venció). */
  quincenas: number;
  parts: P[];
  total: number;
  /** Falta avisar en este tramo (alguna parte no tiene aviso con este tramo). */
  needsNotice: boolean;
  /** Último aviso enviado sobre estas partes, si hay. */
  lastSentAt: string | null;
};

/**
 * Agrupa por miembro + fecha límite + moneda. `bucket` da el tramo de una
 * parte (o `null` si todavía no se avisa) y `sentFor` los avisos ya enviados
 * sobre esa parte. Orden: fecha límite y luego miembro.
 */
export function groupNotices<P extends NoticePart>(
  parts: P[],
  bucket: (p: P) => number | null,
  sentFor: (p: P) => { quincenas: number; sent_at: string }[],
): GroupedNotice<P>[] {
  const groups = new Map<string, GroupedNotice<P>>();
  for (const p of parts) {
    if (p.paid) continue;
    const quincenas = bucket(p);
    if (quincenas === null) continue;
    const key = `${p.member_id}:${p.due_on}:${p.currency}`;
    const g: GroupedNotice<P> = groups.get(key) ?? {
      member_id: p.member_id,
      due_on: p.due_on,
      currency: p.currency,
      quincenas,
      parts: [],
      total: 0,
      needsNotice: false,
      lastSentAt: null,
    };
    g.parts.push(p);
    g.total = fromCents(toCents(g.total) + toCents(p.amount));
    const mine = sentFor(p);
    if (!mine.some((n) => n.quincenas === quincenas)) g.needsNotice = true;
    for (const n of mine) if (!g.lastSentAt || n.sent_at > g.lastSentAt) g.lastSentAt = n.sent_at;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) =>
    a.due_on === b.due_on ? a.member_id.localeCompare(b.member_id) : a.due_on < b.due_on ? -1 : 1,
  );
}
