"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { FormResult } from "@/lib/forms";
import { toFormResult } from "@/lib/catalog-actions";
import { createFeedbackPost, markFeedbackRead, replyToFeedback, setFeedbackStatus } from "@/application";
import { repositories } from "@/infrastructure/container";
import { getProfile } from "@/lib/preferences";

/** Lo que `createFeedbackAction` devuelve además del resultado: a dónde ir. */
export type CreateFeedbackResult = FormResult & { id?: string; warning?: string };

function revalidate(postId?: string) {
  revalidatePath("/comentarios");
  revalidatePath("/comentarios/bandeja");
  if (postId) revalidatePath(`/comentarios/${postId}`);
}

/** B1/B2/B4: publicar en el buzón. */
export async function createFeedbackAction(_prev: FormResult, formData: FormData): Promise<CreateFeedbackResult> {
  const user = await requireUser();
  const image = formData.get("image");
  const file = image instanceof File && image.size > 0 ? image : null;
  const profile = await getProfile();
  const result = await createFeedbackPost((await repositories()).feedback, {
    author: { fullName: profile?.full_name ?? null, email: user.email },
    kind: formData.get("kind"),
    title: formData.get("title") as string | null,
    body: formData.get("body") as string | null,
    image: file ? { bytes: await file.arrayBuffer(), type: file.type, size: file.size } : null,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidate(result.value.id);
  return {
    ok: true,
    id: result.value.id,
    warning: result.value.imageFailed ? "Se publicó, pero no se pudo subir la captura" : undefined,
  };
}

/** B1/B6: responder en una conversación (como dueño o como admin). */
export async function replyFeedbackAction(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const postId = String(formData.get("post_id") ?? "");
  const result = await replyToFeedback((await repositories()).feedback, {
    postId,
    body: formData.get("body") as string | null,
    asAdmin: user.isAdmin && formData.get("as_admin") === "true",
  });
  if (result.ok) revalidate(postId);
  return toFormResult(result);
}

/** B3: el admin cambia el estado (con motivo en "No por ahora"). */
export async function setFeedbackStatusAction(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  if (!user.isAdmin) return { ok: false, message: "Solo el equipo de Finance OS cambia el estado" };
  const postId = String(formData.get("post_id") ?? "");
  const result = await setFeedbackStatus((await repositories()).feedback, {
    postId,
    status: formData.get("status"),
    reason: formData.get("reason") as string | null,
  });
  if (result.ok) revalidate(postId);
  return toFormResult(result);
}

/** B5: al abrir una conversación con algo sin leer (el punto del menú se actualiza). */
export async function markFeedbackReadAction(postId: string, side: "user" | "admin"): Promise<FormResult> {
  const user = await requireUser();
  if (side === "admin" && !user.isAdmin) return { ok: false };
  const result = await markFeedbackRead((await repositories()).feedback, { postId, side });
  // El punto del menú vive en el layout.
  if (result.ok) revalidatePath("/", "layout");
  return toFormResult(result);
}
