/**
 * 3.2.0 · Fase 3: buzón de comentarios.
 *
 * - B1: una publicación tiene tipo, título (3–120) y texto (1–4000); una
 *   respuesta, texto (1–4000).
 * - B2: es privada (el usuario y el admin) y va siempre con el nombre del
 *   autor: el del perfil o, si no hay, el correo.
 * - B3: estados Recibido → En revisión → En planes → Hecho, o No por ahora.
 *   Solo el admin los cambia; "No por ahora" pide el motivo (se envía como
 *   respuesta).
 * - B4: la captura opcional es JPG, PNG o WebP de hasta 5 MB.
 * - B5: "sin leer" = hay actividad del otro lado después de la última lectura.
 * - B6: no se responde en lo que ya está Hecho o No por ahora: se escribe una
 *   publicación nueva.
 */

import { DomainError } from "../shared/errors.ts";

export const FEEDBACK_KINDS = ["experiencia", "duda", "mejora", "deseo"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  experiencia: "Experiencia",
  duda: "Duda",
  mejora: "Mejora",
  deseo: "Me gustaría que tuviera",
};

/** Qué escribir en cada tipo (ayuda del formulario). */
export const FEEDBACK_KIND_HINT: Record<FeedbackKind, string> = {
  experiencia: "Cómo te ha ido: lo que te sirvió y lo que no.",
  duda: "Algo que no entiendes o no sabes cómo hacer.",
  mejora: "Algo que ya existe y podría funcionar mejor.",
  deseo: "Algo que todavía no tiene y te serviría.",
};

export const FEEDBACK_STATUSES = ["recibido", "en_revision", "en_planes", "hecho", "no_por_ahora"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  recibido: "Recibido",
  en_revision: "En revisión",
  en_planes: "En planes",
  hecho: "Hecho",
  no_por_ahora: "No por ahora",
};

/** Lo que significa cada estado para quien escribió. */
export const FEEDBACK_STATUS_HINT: Record<FeedbackStatus, string> = {
  recibido: "Lo recibimos. Lo vamos a leer pronto.",
  en_revision: "Lo estamos revisando.",
  en_planes: "Va a entrar en una próxima versión.",
  hecho: "Ya está en la app.",
  no_por_ahora: "No entra por ahora; en la conversación está el motivo.",
};

export const FEEDBACK_TITLE_MIN = 3;
export const FEEDBACK_TITLE_MAX = 120;
export const FEEDBACK_BODY_MAX = 4000;

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return (FEEDBACK_KINDS as readonly unknown[]).includes(value);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly unknown[]).includes(value);
}

function cleanBody(body: string | null | undefined): string {
  const text = (body ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) throw new DomainError("B1", "Escribe tu mensaje");
  if (text.length > FEEDBACK_BODY_MAX) {
    throw new DomainError("B1", `El mensaje puede tener hasta ${FEEDBACK_BODY_MAX} caracteres`);
  }
  return text;
}

/** B1: valida y limpia una publicación nueva. */
export function validateFeedbackPost(input: { kind: unknown; title: string | null | undefined; body: string | null | undefined }): {
  kind: FeedbackKind;
  title: string;
  body: string;
} {
  if (!isFeedbackKind(input.kind)) throw new DomainError("B1", "Elige de qué se trata");
  const title = (input.title ?? "").replace(/\s+/g, " ").trim();
  if (title.length < FEEDBACK_TITLE_MIN) throw new DomainError("B1", "Ponle un título corto (3 caracteres o más)");
  if (title.length > FEEDBACK_TITLE_MAX) {
    throw new DomainError("B1", `El título puede tener hasta ${FEEDBACK_TITLE_MAX} caracteres`);
  }
  return { kind: input.kind, title, body: cleanBody(input.body) };
}

/** B1/B6: valida una respuesta en una conversación abierta. */
export function validateFeedbackReply(status: FeedbackStatus, body: string | null | undefined): string {
  if (isFeedbackClosed(status)) {
    throw new DomainError("B6", "Esta conversación ya se cerró. Escribe una publicación nueva.");
  }
  return cleanBody(body);
}

/** B6: Hecho y No por ahora cierran la conversación. */
export function isFeedbackClosed(status: FeedbackStatus): boolean {
  return status === "hecho" || status === "no_por_ahora";
}

/** B3: cambio de estado del admin. "No por ahora" pide el motivo. */
export function validateStatusChange(
  from: FeedbackStatus,
  to: unknown,
  reason: string | null | undefined,
): { status: FeedbackStatus; reason: string | null } {
  if (!isFeedbackStatus(to)) throw new DomainError("B3", "Ese estado no existe");
  if (to === from) throw new DomainError("B3", "Ya está en ese estado");
  const text = (reason ?? "").trim();
  if (to === "no_por_ahora" && !text) throw new DomainError("B3", "Cuenta el motivo para que sepa por qué");
  return { status: to, reason: text ? cleanBody(text) : null };
}

/** B2: nombre con el que se firma (perfil, o el correo si no hay nombre). */
export function feedbackAuthorName(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = (fullName ?? "").trim() || (email ?? "").trim();
  if (!name) throw new DomainError("B2", "Completa tu nombre en Mi cuenta para escribir");
  return name.slice(0, 80);
}

/** B4: la captura es JPG, PNG o WebP de hasta 5 MB. */
export const FEEDBACK_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const FEEDBACK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function validateFeedbackImage(file: { type: string; size: number }): void {
  if (!(FEEDBACK_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new DomainError("B4", "La captura debe ser JPG, PNG o WebP");
  }
  if (file.size > FEEDBACK_IMAGE_MAX_BYTES) throw new DomainError("B4", "La captura pesa más de 5 MB");
}

/** B5: ¿hay algo del otro lado que no se ha leído? */
export function isFeedbackUnread(otherSideActivityAt: string | null, readAt: string | null): boolean {
  if (!otherSideActivityAt) return false;
  return !readAt || Date.parse(otherSideActivityAt) > Date.parse(readAt);
}
