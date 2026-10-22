import assert from "node:assert/strict";
import { test } from "node:test";
import { createFeedbackPost, replyToFeedback, setFeedbackStatus } from "./feedback.ts";
import { InfrastructureError, type FeedbackMessageRecord, type FeedbackPostRecord, type FeedbackRepository } from "./ports.ts";

function inbox(options: { failAttach?: boolean } = {}) {
  const posts = new Map<string, FeedbackPostRecord>();
  const messages: FeedbackMessageRecord[] = [];
  const attached = new Set<string>();
  let seq = 0;
  const now = () => new Date(Date.UTC(2026, 9, 21, 12, 0, seq++)).toISOString();
  const feedback: FeedbackRepository = {
    async create(input) {
      const id = `p${posts.size + 1}`;
      const at = now();
      posts.set(id, {
        id,
        user_id: "u1",
        ...input,
        status: "recibido",
        has_attachment: false,
        user_activity_at: at,
        admin_activity_at: null,
        user_read_at: at,
        admin_read_at: null,
        created_at: at,
      });
      messages.push({ id: `m${messages.length}`, post_id: id, from_admin: false, body: input.body, created_at: at });
      return { id };
    },
    async attach(postId) {
      if (options.failAttach) throw new InfrastructureError("No se pudo subir la captura");
      attached.add(postId);
    },
    async attachmentUrl(postId) {
      return attached.has(postId) ? `https://firmado/${postId}` : null;
    },
    async mine() {
      return [...posts.values()];
    },
    async all() {
      return [...posts.values()];
    },
    async find(postId) {
      return posts.get(postId) ?? null;
    },
    async messages(postId) {
      return messages.filter((m) => m.post_id === postId);
    },
    async reply(postId, body, fromAdmin) {
      messages.push({ id: `m${messages.length}`, post_id: postId, from_admin: fromAdmin, body, created_at: now() });
    },
    async setStatus(postId, status) {
      posts.set(postId, { ...posts.get(postId)!, status });
    },
    async markRead() {},
    async unread() {
      return { mine: 0, inbox: 0 };
    },
  };
  return { feedback, posts, messages, attached };
}

const author = { fullName: "Ana Mora", email: "ana@x.com" };

test("B1/B2: publicar guarda el texto como primer mensaje y firma con el nombre", async () => {
  const s = inbox();
  const result = await createFeedbackPost(s.feedback, { author, kind: "deseo", title: "Presupuesto", body: "Quiero un presupuesto" });
  assert.ok(result.ok);
  assert.equal(s.posts.get("p1")?.author_name, "Ana Mora");
  assert.deepEqual(s.messages.map((m) => m.body), ["Quiero un presupuesto"]);

  const bad = await createFeedbackPost(s.feedback, { author, kind: "deseo", title: "x", body: "y" });
  assert.equal(!bad.ok && bad.rule, "B1");
});

test("B4: la captura se valida antes de publicar; si no sube, la publicación queda y se avisa", async () => {
  const s = inbox();
  const gif = { bytes: new ArrayBuffer(4), type: "image/gif", size: 4 };
  const rejected = await createFeedbackPost(s.feedback, { author, kind: "duda", title: "Una duda", body: "¿Cómo?", image: gif });
  assert.equal(!rejected.ok && rejected.rule, "B4");
  assert.equal(s.posts.size, 0);

  const png = { ...gif, type: "image/png" };
  const ok = await createFeedbackPost(s.feedback, { author, kind: "duda", title: "Una duda", body: "¿Cómo?", image: png });
  assert.ok(ok.ok && !ok.value.imageFailed);
  assert.ok(s.attached.has("p1"));

  const failing = inbox({ failAttach: true });
  const partial = await createFeedbackPost(failing.feedback, { author, kind: "duda", title: "Una duda", body: "¿Cómo?", image: png });
  assert.ok(partial.ok && partial.value.imageFailed);
  assert.equal(failing.posts.size, 1);
});

test("B3: 'No por ahora' pide motivo y lo deja como respuesta del admin", async () => {
  const s = inbox();
  await createFeedbackPost(s.feedback, { author, kind: "mejora", title: "Modo compacto", body: "Más filas" });
  const noReason = await setFeedbackStatus(s.feedback, { postId: "p1", status: "no_por_ahora", reason: "" });
  assert.equal(!noReason.ok && noReason.rule, "B3");

  assert.ok((await setFeedbackStatus(s.feedback, { postId: "p1", status: "no_por_ahora", reason: "Primero la versión móvil" })).ok);
  assert.equal(s.posts.get("p1")?.status, "no_por_ahora");
  assert.deepEqual(s.messages.at(-1), { ...s.messages.at(-1)!, from_admin: true, body: "Primero la versión móvil" });
});

test("B6: el usuario no responde en lo cerrado; el admin sí", async () => {
  const s = inbox();
  await createFeedbackPost(s.feedback, { author, kind: "mejora", title: "Modo compacto", body: "Más filas" });
  await setFeedbackStatus(s.feedback, { postId: "p1", status: "hecho", reason: "Ya está" });
  const user = await replyToFeedback(s.feedback, { postId: "p1", body: "¡Gracias!", asAdmin: false });
  assert.equal(!user.ok && user.rule, "B6");
  assert.ok((await replyToFeedback(s.feedback, { postId: "p1", body: "Avísanos cómo te va", asAdmin: true })).ok);
  const missing = await replyToFeedback(s.feedback, { postId: "zz", body: "hola", asAdmin: false });
  assert.equal(missing.ok, false);
});
