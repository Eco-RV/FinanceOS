import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toMailMessage } from "./outlook.ts";
import { parseBac } from "./parsers/bac.ts";

const fixture = readFileSync(new URL("./parsers/fixtures/bac-compra.html", import.meta.url), "utf8");

test("Outlook: un mensaje de Graph se lee con el mismo formato del BAC", () => {
  const msg = toMailMessage({
    id: "AAkALg==",
    subject: "Notificación de transacción WALMART 04-10-2026 - 18:38",
    from: { emailAddress: { name: "BAC", address: "notificacionbac@baccredomatic.cr" } },
    body: { contentType: "html", content: fixture },
  });
  assert.equal(msg.from, "BAC <notificacionbac@baccredomatic.cr>");
  assert.equal(msg.text, null);
  const parsed = parseBac(msg);
  assert.ok(parsed);
  assert.equal(parsed.amount, 22_920);
  assert.equal(parsed.occurredOn, "2026-10-04");
});

test("Outlook: un cuerpo de texto va en `text`", () => {
  const msg = toMailMessage({ id: "x", body: { contentType: "text", content: "hola" } });
  assert.equal(msg.html, null);
  assert.equal(msg.text, "hola");
});
