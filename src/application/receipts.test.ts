import assert from "node:assert/strict";
import { test } from "node:test";
import { attachReceipt, receiptUrl, removeReceipt } from "./receipts.ts";
import type { ReceiptStorage } from "./ports.ts";

function store() {
  const files = new Map<string, string>();
  const receipts: ReceiptStorage = {
    async attach(id, file) {
      files.set(id, file.type);
    },
    async urlOf(id) {
      return files.has(id) ? `https://firmado/${id}` : null;
    },
    async remove(id) {
      files.delete(id);
    },
  };
  return { files, receipts };
}

test("G8: adjuntar, ver y quitar un comprobante", async () => {
  const s = store();
  const pdf = { bytes: new ArrayBuffer(10), type: "application/pdf", size: 10 };
  assert.ok((await attachReceipt(s.receipts, { movement_id: "mv1", file: pdf })).ok);
  const url = await receiptUrl(s.receipts, "mv1");
  assert.ok(url.ok && url.value.url.endsWith("mv1"));
  const gif = await attachReceipt(s.receipts, { movement_id: "mv1", file: { ...pdf, type: "image/gif" } });
  assert.equal(!gif.ok && gif.rule, "G8");
  assert.ok((await removeReceipt(s.receipts, "mv1")).ok);
  assert.equal((await receiptUrl(s.receipts, "mv1")).ok, false);
});
