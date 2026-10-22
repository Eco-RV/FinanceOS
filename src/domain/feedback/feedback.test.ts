import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import {
  feedbackAuthorName,
  isFeedbackClosed,
  isFeedbackUnread,
  validateFeedbackImage,
  validateFeedbackPost,
  validateFeedbackReply,
  validateStatusChange,
} from "./feedback.ts";

const rule = (id: string) => (e: unknown) => e instanceof DomainError && e.rule === id;

test("B1: publicación con tipo, título y texto; limpia espacios", () => {
  assert.deepEqual(validateFeedbackPost({ kind: "mejora", title: "  Filtro   por  banco ", body: "\n Me serviría.\r\n " }), {
    kind: "mejora",
    title: "Filtro por banco",
    body: "Me serviría.",
  });
  assert.throws(() => validateFeedbackPost({ kind: "queja", title: "Algo", body: "x" }), rule("B1"));
  assert.throws(() => validateFeedbackPost({ kind: "duda", title: "ab", body: "x" }), rule("B1"));
  assert.throws(() => validateFeedbackPost({ kind: "duda", title: "Una duda", body: "   " }), rule("B1"));
  assert.throws(() => validateFeedbackPost({ kind: "duda", title: "Una duda", body: "x".repeat(4001) }), rule("B1"));
});

test("B6: no se responde en una conversación cerrada", () => {
  assert.equal(validateFeedbackReply("en_revision", " Gracias "), "Gracias");
  assert.equal(isFeedbackClosed("hecho"), true);
  assert.equal(isFeedbackClosed("en_planes"), false);
  assert.throws(() => validateFeedbackReply("hecho", "Otra cosa"), rule("B6"));
  assert.throws(() => validateFeedbackReply("no_por_ahora", "Otra cosa"), rule("B6"));
});

test("B3: el cambio de estado existe, es distinto y 'No por ahora' pide motivo", () => {
  assert.deepEqual(validateStatusChange("recibido", "en_planes", ""), { status: "en_planes", reason: null });
  assert.deepEqual(validateStatusChange("recibido", "hecho", " Ya salió "), { status: "hecho", reason: "Ya salió" });
  assert.throws(() => validateStatusChange("recibido", "recibido", ""), rule("B3"));
  assert.throws(() => validateStatusChange("recibido", "cerrado", ""), rule("B3"));
  assert.throws(() => validateStatusChange("en_revision", "no_por_ahora", "  "), rule("B3"));
});

test("B2: firma con el nombre del perfil o, si no hay, con el correo", () => {
  assert.equal(feedbackAuthorName(" Ana Mora ", "ana@x.com"), "Ana Mora");
  assert.equal(feedbackAuthorName(null, "ana@x.com"), "ana@x.com");
  assert.throws(() => feedbackAuthorName("", ""), rule("B2"));
});

test("B4: captura JPG, PNG o WebP de hasta 5 MB", () => {
  validateFeedbackImage({ type: "image/png", size: 1024 });
  assert.throws(() => validateFeedbackImage({ type: "application/pdf", size: 1024 }), rule("B4"));
  assert.throws(() => validateFeedbackImage({ type: "image/jpeg", size: 6 * 1024 * 1024 }), rule("B4"));
});

test("B5: sin leer cuando el otro lado escribió después de la última lectura", () => {
  assert.equal(isFeedbackUnread(null, "2026-10-21T10:00:00+00:00"), false);
  assert.equal(isFeedbackUnread("2026-10-21T11:00:00+00:00", "2026-10-21T10:00:00+00:00"), true);
  assert.equal(isFeedbackUnread("2026-10-21T09:00:00+00:00", "2026-10-21T10:00:00+00:00"), false);
  assert.equal(isFeedbackUnread("2026-10-21T09:00:00+00:00", null), true);
});
