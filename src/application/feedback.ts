/** 3.2.0 · Fase 3: buzón de comentarios (B1–B6). */

import {
  feedbackAuthorName,
  validateFeedbackImage,
  validateFeedbackPost,
  validateFeedbackReply,
  validateStatusChange,
} from "../domain/index.ts";
import { InfrastructureError, type FeedbackRepository } from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

type ImageFile = { bytes: ArrayBuffer; type: string; size: number };

/**
 * B1/B2/B4: publica en el buzón con el nombre del autor. La captura se valida
 * antes de publicar; si después no se puede subir, la publicación queda (lo
 * importante es el texto) y se avisa con `imageFailed`.
 */
export function createFeedbackPost(
  feedback: FeedbackRepository,
  input: {
    author: { fullName: string | null; email: string | null };
    kind: unknown;
    title: string | null;
    body: string | null;
    image?: ImageFile | null;
  },
): Promise<UseCaseResult<{ id: string; imageFailed: boolean }>> {
  return run(async () => {
    const post = validateFeedbackPost(input);
    const author_name = feedbackAuthorName(input.author.fullName, input.author.email);
    if (input.image) validateFeedbackImage(input.image);
    const { id } = await feedback.create({ author_name, ...post });
    let imageFailed = false;
    if (input.image) {
      try {
        await feedback.attach(id, input.image);
      } catch (e) {
        if (!(e instanceof InfrastructureError)) throw e;
        imageFailed = true;
      }
    }
    return ok({ id, imageFailed });
  });
}

/** B1/B6: responder. El usuario no responde en lo cerrado; el admin siempre puede. */
export function replyToFeedback(
  feedback: FeedbackRepository,
  input: { postId: string; body: string | null; asAdmin: boolean },
): Promise<UseCaseResult> {
  return run(async () => {
    const post = await feedback.find(input.postId);
    if (!post) return fail("No encontramos esa conversación");
    const body = validateFeedbackReply(input.asAdmin ? "en_revision" : post.status, input.body);
    await feedback.reply(post.id, body, input.asAdmin);
    return ok();
  });
}

/** B3: el admin cambia el estado; el motivo (obligatorio en "No por ahora") va como respuesta. */
export function setFeedbackStatus(
  feedback: FeedbackRepository,
  input: { postId: string; status: unknown; reason: string | null },
): Promise<UseCaseResult> {
  return run(async () => {
    const post = await feedback.find(input.postId);
    if (!post) return fail("No encontramos esa conversación");
    const change = validateStatusChange(post.status, input.status, input.reason);
    if (change.reason) await feedback.reply(post.id, change.reason, true);
    await feedback.setStatus(post.id, change.status);
    return ok();
  });
}

/** B5: marca leída la conversación del lado de quien la abre. */
export function markFeedbackRead(
  feedback: FeedbackRepository,
  input: { postId: string; side: "user" | "admin" },
): Promise<UseCaseResult> {
  return run(async () => {
    await feedback.markRead(input.postId, input.side);
    return ok();
  });
}
