"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { memberSchema, sharedExpenseSchema, sharedPaymentSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import { toFormResult } from "@/lib/catalog-actions";
import { loadSharedBoard } from "@/lib/shared-board";
import { sharedNoticeMessage } from "@/lib/notices";
import {
  createSharedExpense,
  deleteSharedExpense as deleteSharedExpenseUseCase,
  markSharedPartPaid,
  recordSharedNotices,
  saveMember,
  sendSharedNoticeEmail,
  shareExpense,
  undoSharedPartPaid,
  updateSharedExpense,
  type NewSharedNotice,
  type NoticeChannel,
} from "@/application";
import { crToday, toISODate, type SharedShare } from "@/domain";
import { repositories } from "@/infrastructure/container";

function revalidateShared(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/procesos");
  revalidatePath("/procesos/compartidos");
  if (id) revalidatePath(`/procesos/compartidos/${id}`);
  revalidatePath("/procesos/cobros");
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/ingresos");
  revalidatePath("/procesos/cuentas", "layout");
  revalidatePath("/procesos/tarjetas", "layout");
  revalidatePath("/ajustes/miembros");
}

/** Partes del formulario: campos `share:<member_id>` con monto > 0 (vacío = no participa). */
function sharesFrom(formData: FormData): SharedShare[] {
  const out: SharedShare[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("share:")) continue;
    const amount = Number(String(value).replace(",", "."));
    if (String(value).trim() === "" || !Number.isFinite(amount)) continue;
    out.push({ member_id: key.slice("share:".length), amount: Math.round(amount * 100) / 100 });
  }
  return out;
}

/**
 * X1: comparte un gasto. Con `movement_id` comparte uno ya registrado; sin él,
 * registra el gasto (paso 1 del asistente) y lo comparte. Al terminar abre el
 * detalle del compartido.
 */
export async function saveSharedExpense(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const parsed = sharedExpenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const shares = sharesFrom(formData);
  const repos = await repositories();

  if (v.id) {
    const result = await updateSharedExpense(repos, {
      id: v.id,
      description: v.description,
      due_on: v.due_on,
      shares,
    });
    if (result.ok) revalidateShared(v.id);
    return toFormResult(result);
  }

  let id: string;
  if (v.movement_id) {
    const result = await shareExpense(repos, {
      movement_id: v.movement_id,
      description: v.description,
      due_on: v.due_on,
      shares,
    });
    if (!result.ok) return toFormResult(result);
    id = result.value.id;
  } else {
    const [kind, originId] = v.origin.split(":");
    let account_id: string | null = null;
    let debit_card_id: string | null = null;
    if (kind === "debit") {
      const { data } = await (await createClient())
        .from("debit_cards")
        .select("account_id")
        .eq("id", originId)
        .maybeSingle();
      account_id = (data?.account_id as string | undefined) ?? null;
      debit_card_id = originId;
      if (!account_id) return { ok: false, message: "Tarjeta de débito no encontrada" };
    } else if (kind === "account") {
      account_id = originId;
    }
    const result = await createSharedExpense(repos, {
      movement: {
        amount: Number(v.amount),
        occurred_on: v.occurred_on!,
        category: v.category,
        note: v.description || null,
        account_id,
        card_id: kind === "card" ? originId : null,
        currency: kind === "card" ? (v.currency ?? null) : null,
        debit_card_id,
      },
      description: v.description,
      due_on: v.due_on,
      shares,
    });
    if (!result.ok) return toFormResult(result);
    id = result.value.id;
  }
  revalidateShared(id);
  redirect(`/procesos/compartidos/${id}`);
}

/** X6: deja de compartir un gasto (el movimiento queda). */
export async function deleteSharedExpense(formData: FormData): Promise<FormResult> {
  await requireUser();
  const id = (formData.get("id") as string) || "";
  const result = await deleteSharedExpenseUseCase(await repositories(), id);
  if (result.ok) revalidateShared(id);
  return toFormResult(result);
}

/** X4: una persona pagó su parte (con ingreso a una cuenta, si se marcó). */
export async function recordSharedPayment(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const parsed = sharedPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const result = await markSharedPartPaid(await repositories(), {
    id: v.id,
    member_id: v.member_id,
    paid_on: v.paid_on,
    channel: v.channel,
    note: v.note,
    income: v.as_income ? { account_id: v.account_id, category: v.category } : null,
  });
  if (result.ok) revalidateShared(v.id);
  return toFormResult(result);
}

export async function undoSharedPayment(formData: FormData): Promise<FormResult> {
  await requireUser();
  const id = (formData.get("id") as string) || "";
  const memberId = (formData.get("member_id") as string) || "";
  const result = await undoSharedPartPaid(await repositories(), { id, member_id: memberId });
  if (result.ok) revalidateShared(id);
  return toFormResult(result);
}

/** Agregar una persona sin salir del asistente (crea el miembro, G4/F8). */
export async function addPerson(
  formData: FormData,
): Promise<{ ok: true; member: { id: string; name: string } } | { ok: false; message: string }> {
  await requireUser();
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: Object.values(fieldErrors(parsed.error))[0] ?? "Datos inválidos" };
  }
  const result = await saveMember((await repositories()).members, { id: null, fields: parsed.data });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/ajustes/miembros");
  return { ok: true, member: { id: result.value.id, name: parsed.data.name } };
}

/** X5: el aviso de una persona para una fecha límite, recalculado en el servidor. */
async function noticeFor(formData: FormData) {
  const memberId = (formData.get("member_id") as string) || "";
  const dueOn = (formData.get("due_on") as string) || "";
  const currency = (formData.get("currency") as string) || "CRC";
  const board = await loadSharedBoard(await createClient(), toISODate(crToday()));
  const group = board.groups.find(
    (g) => g.member_id === memberId && g.due_on === dueOn && g.currency === currency,
  );
  const member = board.members.get(memberId);
  if (!group || !member) return null;
  const items = (channel: NoticeChannel): NewSharedNotice[] =>
    group.parts.map((p) => ({
      shared_expense_id: p.shared_expense_id,
      member_id: p.member_id,
      quincenas: group.quincenas,
      channel,
    }));
  return { member, items, message: sharedNoticeMessage(member.name, group, board.expenses) };
}

export async function sendSharedEmailNotice(formData: FormData): Promise<FormResult> {
  await requireUser();
  const notice = await noticeFor(formData);
  if (!notice) return { ok: false, message: "Ese aviso ya no está pendiente" };
  const result = await sendSharedNoticeEmail(await repositories(), {
    to: notice.member.email,
    subject: notice.message.subject,
    text: notice.message.text,
    items: notice.items("email"),
  });
  if (result.ok) revalidateShared();
  return toFormResult(result);
}

/** WhatsApp lo envía el usuario desde el enlace; aquí solo queda constancia. */
export async function recordSharedWhatsappNotice(formData: FormData): Promise<FormResult> {
  await requireUser();
  const notice = await noticeFor(formData);
  if (!notice) return { ok: false, message: "Ese aviso ya no está pendiente" };
  const result = await recordSharedNotices((await repositories()).sharedExpenses, notice.items("whatsapp"));
  if (result.ok) revalidateShared();
  return toFormResult(result);
}
