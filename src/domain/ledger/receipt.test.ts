import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import { RECEIPT_MAX_BYTES, validateReceipt } from "./receipt.ts";

const rule = (id: string) => (e: unknown) => e instanceof DomainError && e.rule === id;

test("G8: tipo y tamaño del comprobante", () => {
  assert.doesNotThrow(() => validateReceipt({ type: "application/pdf", size: 120_000 }));
  assert.doesNotThrow(() => validateReceipt({ type: "image/jpeg", size: RECEIPT_MAX_BYTES }));
  assert.throws(() => validateReceipt({ type: "image/gif", size: 10 }), rule("G8"));
  assert.throws(() => validateReceipt({ type: "image/png", size: 0 }), rule("G8"));
  assert.throws(() => validateReceipt({ type: "image/png", size: RECEIPT_MAX_BYTES + 1 }), rule("G8"));
});
