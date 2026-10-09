import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptToken, encryptToken } from "./crypto.ts";

process.env.MAIL_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");

test("cifra y descifra un token", () => {
  const enc = encryptToken("1//refresh-token");
  assert.notEqual(enc, "1//refresh-token");
  assert.equal(decryptToken(enc), "1//refresh-token");
});

test("dos cifrados del mismo texto difieren (IV aleatorio)", () => {
  assert.notEqual(encryptToken("x"), encryptToken("x"));
});

test("un payload alterado no descifra", () => {
  const [iv, tag, enc] = encryptToken("secreto").split(".");
  const flipped = Buffer.from(enc, "base64");
  flipped[0] ^= 1;
  assert.throws(() =>
    decryptToken([iv, tag, flipped.toString("base64")].join(".")),
  );
});
