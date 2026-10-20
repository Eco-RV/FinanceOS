import type { NoticeGroup, SharedNoticeGroup } from "@/domain";
import { formatCurrency, formatDate } from "@/lib/format";

export type NoticePlan = { description: string; months: number; cardName: string };

function whenLabel(group: Pick<NoticeGroup, "due_on" | "quincenas">): string {
  const date = formatDate(group.due_on);
  if (group.quincenas === 0) return `ya venció el ${date}`;
  return `vence el ${date} (falta${group.quincenas === 1 ? "" : "n"} ${group.quincenas} quincena${group.quincenas === 1 ? "" : "s"})`;
}

/** F8: texto del aviso de cuota para un miembro (correo o WhatsApp). */
export function noticeMessage(
  memberName: string,
  group: Pick<NoticeGroup, "due_on" | "quincenas" | "parts" | "total" | "currency">,
  plans: Map<string, NoticePlan>,
): { subject: string; text: string } {
  const currency = group.currency;
  const lines = group.parts.map((p) => {
    const plan = plans.get(p.financing_id);
    const what = plan
      ? `${plan.description} (${plan.cardName}), cuota ${p.installment_no}/${plan.months}`
      : `Cuota ${p.installment_no}`;
    return `• ${what}: ${formatCurrency(p.amount, currency)}`;
  });
  const total = formatCurrency(group.total, currency);
  const text = [
    `Hola ${memberName}:`,
    "",
    `Te recuerdo tu parte de la tarjeta que ${whenLabel(group)}:`,
    ...lines,
    "",
    group.parts.length > 1 ? `Total: ${total}` : null,
    "¡Gracias!",
  ]
    .filter((l) => l !== null)
    .join("\n");
  return { subject: `Tu parte de la cuota: ${total} · ${formatDate(group.due_on)}`, text };
}

/** Enlace de WhatsApp con el mensaje ya escrito; el usuario toca Enviar. */
export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/** Teléfono guardado (con código de país) para mostrar: "8888 7777" en Costa Rica. */
export function phoneLabel(phone: string | null): string {
  if (!phone) return "—";
  const local = phone.startsWith("506") && phone.length === 11 ? phone.slice(3) : phone;
  return local.length === 8 ? `${local.slice(0, 4)} ${local.slice(4)}` : `+${local}`;
}

export type SharedNoticeExpense = { description: string; occurred_on: string };

/** X5: texto del aviso de un gasto compartido para una persona. */
export function sharedNoticeMessage(
  memberName: string,
  group: Pick<SharedNoticeGroup, "due_on" | "quincenas" | "parts" | "total" | "currency">,
  expenses: Map<string, SharedNoticeExpense>,
): { subject: string; text: string } {
  const currency = group.currency;
  const lines = group.parts.map((p) => {
    const e = expenses.get(p.shared_expense_id);
    const what = e ? `${e.description} (${formatDate(e.occurred_on)})` : "Gasto compartido";
    return `• ${what}: ${formatCurrency(p.amount, currency)}`;
  });
  const total = formatCurrency(group.total, currency);
  // Tramo 4 = más de 3 quincenas: se dice solo la fecha.
  const when =
    group.quincenas > 3 ? `antes del ${formatDate(group.due_on)}` : whenLabel(group);
  const text = [
    `Hola ${memberName}:`,
    "",
    `Te paso tu parte de lo que compartimos; ${when}:`,
    ...lines,
    "",
    group.parts.length > 1 ? `Total: ${total}` : null,
    "¡Gracias!",
  ]
    .filter((l) => l !== null)
    .join("\n");
  return { subject: `Tu parte: ${total} · antes del ${formatDate(group.due_on)}`, text };
}
