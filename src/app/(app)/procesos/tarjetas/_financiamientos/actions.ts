"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createFinancing as createFinancingUseCase,
  deleteFinancing as deleteFinancingUseCase,
  recordNotices,
  recordReimbursement as recordReimbursementUseCase,
  sendNoticeEmail,
  setFinancingShares,
  undoReimbursement as undoReimbursementUseCase,
  updateFinancing as updateFinancingUseCase,
  prepayFinancing,
  undoFinancingPrepayment,
  type NewNotice,
  type NoticeChannel,
} from "@/application";
import { crToday, toISODate } from "@/domain";
import { repositories } from "@/infrastructure/container";
import { createClient } from "@/lib/supabase/server";
import { financingEditSchema, financingSchema, reimbursementSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import { toFormResult } from "@/lib/catalog-actions";
import { loadFinancingBoard } from "@/lib/financing-board";
import { noticeMessage } from "@/lib/notices";

function revalidateFinancing(cardId: string | null | undefined) {
  revalidatePath("/dashboard");
  revalidatePath("/procesos/tarjetas");
  revalidatePath("/procesos/cobros");
  // `layout` cubre también el detalle de cada financiamiento de la tarjeta.
  if (cardId) revalidatePath(`/procesos/tarjetas/${cardId}`, "layout");
}

export async function createFinancing(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const parsed = financingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const result = await createFinancingUseCase(await repositories(), parsed.data);
  if (!result.ok) return { ok: false, message: result.message };

  revalidateFinancing(parsed.data.card_id);
  return { ok: true };
}

/** F9: descripción y categoría. */
export async function updateFinancing(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();
  const parsed = financingEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const result = await updateFinancingUseCase(await repositories(), parsed.data);
  if (result.ok) revalidateFinancing(result.value.cardId);
  return toFormResult(result);
}

export async function deleteFinancing(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  const result = await deleteFinancingUseCase(await repositories(), id);
  if (result.ok) revalidateFinancing(result.value.cardId);
}

/**
 * F6: reparto por cuota. El formulario manda un campo `share:<member_id>` por
 * cada miembro; vacío o 0 = no participa.
 */
export async function saveFinancingShares(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();
  const financingId = (formData.get("financing_id") as string) || "";
  if (!financingId) return { ok: false, message: "Falta el financiamiento" };

  const shares: { member_id: string; amount: number }[] = [];
  const errors: Record<string, string> = {};
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("share:")) continue;
    const text = String(raw).trim();
    if (!text) continue;
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount < 0) {
      errors[key] = "Monto inválido";
      continue;
    }
    if (amount > 0) shares.push({ member_id: key.slice("share:".length), amount });
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const result = await setFinancingShares(await repositories(), {
    financing_id: financingId,
    shares,
  });
  if (result.ok) revalidateFinancing(result.value.cardId);
  return toFormResult(result);
}

/** F7: un miembro pagó su parte de una cuota. */
export async function recordReimbursement(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();
  const parsed = reimbursementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const result = await recordReimbursementUseCase(await repositories(), parsed.data);
  if (result.ok) revalidateFinancing(result.value.cardId);
  return toFormResult(result);
}

export async function undoReimbursement(formData: FormData): Promise<FormResult> {
  await requireUser();
  const id = (formData.get("id") as string) || "";
  if (!id) return { ok: false, message: "Falta el reembolso" };
  const result = await undoReimbursementUseCase(await repositories(), id);
  if (result.ok) revalidateFinancing(result.value.cardId);
  return toFormResult(result);
}

/**
 * F8: el aviso de un miembro para una fecha límite. Se vuelve a calcular en
 * el servidor (no se confía en lo que manda el navegador).
 */
async function noticeFor(formData: FormData) {
  const memberId = (formData.get("member_id") as string) || "";
  const dueOn = (formData.get("due_on") as string) || "";
  const currency = (formData.get("currency") as string) || "CRC";
  const board = await loadFinancingBoard(await createClient(), toISODate(crToday()));
  const group = board.groups.find(
    (g) => g.member_id === memberId && g.due_on === dueOn && g.currency === currency,
  );
  const member = board.members.get(memberId);
  if (!group || !member) return null;
  const items = (channel: NoticeChannel): NewNotice[] =>
    group.parts.map((p) => ({
      financing_id: p.financing_id,
      member_id: p.member_id,
      installment_no: p.installment_no,
      quincenas: group.quincenas,
      channel,
    }));
  return { group, member, items, message: noticeMessage(member.name, group, board.plans) };
}

function revalidateNotices() {
  revalidatePath("/dashboard");
  revalidatePath("/procesos/cobros");
}

export async function sendEmailNotice(formData: FormData): Promise<FormResult> {
  await requireUser();
  const notice = await noticeFor(formData);
  if (!notice) return { ok: false, message: "Ese aviso ya no está pendiente" };

  const repos = await repositories();
  const result = await sendNoticeEmail(repos, {
    to: notice.member.email,
    subject: notice.message.subject,
    text: notice.message.text,
    items: notice.items("email"),
  });
  if (result.ok) revalidateNotices();
  return toFormResult(result);
}

/** WhatsApp lo envía el usuario desde el enlace; aquí solo queda constancia. */
export async function recordWhatsappNotice(formData: FormData): Promise<FormResult> {
  await requireUser();
  const notice = await noticeFor(formData);
  if (!notice) return { ok: false, message: "Ese aviso ya no está pendiente" };
  const result = await recordNotices((await repositories()).notices, notice.items("whatsapp"));
  if (result.ok) revalidateNotices();
  return toFormResult(result);
}

const uuidRe = /^[0-9a-fA-F-]{36}$/;

/** F11 (3.1.0): abono extraordinario al capital de un financiamiento. */
export async function prepayFinancingAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const financing_id = String(formData.get("financing_id") ?? "");
  const account_id = String(formData.get("account_id") ?? "");
  const amount = Number(formData.get("amount"));
  const mode = formData.get("mode") === "payment" ? "payment" : "term";
  const occurred_on = String(formData.get("occurred_on") ?? "");
  const errors: Record<string, string> = {};
  if (!uuidRe.test(account_id)) errors.account_id = "Elige la cuenta";
  if (!(amount > 0)) errors.amount = "Debe ser mayor que 0";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurred_on)) errors.occurred_on = "Fecha inválida";
  if (!uuidRe.test(financing_id) || Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await prepayFinancing(await repositories(), {
    financing_id,
    account_id,
    amount,
    mode,
    occurred_on,
    today: toISODate(crToday()),
  });
  if (result.ok) {
    revalidateFinancing(result.value.cardId);
    revalidatePath("/procesos/gastos");
    revalidatePath("/procesos/cuentas", "layout");
  }
  return toFormResult(result);
}

export async function undoFinancingPrepaymentAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const financing_id = String(formData.get("financing_id") ?? "");
  const result = await undoFinancingPrepayment(await repositories(), { financing_id, today: toISODate(crToday()) });
  if (result.ok) {
    revalidateFinancing(result.value.cardId);
    revalidatePath("/procesos/gastos");
    revalidatePath("/procesos/cuentas", "layout");
  }
  return toFormResult(result);
}
