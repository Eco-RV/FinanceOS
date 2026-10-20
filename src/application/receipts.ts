/** G8 (3.1.0): adjuntar, ver y quitar el comprobante de un movimiento. */

import { validateReceipt } from "../domain/index.ts";
import type { ReceiptStorage } from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

export function attachReceipt(
  receipts: ReceiptStorage,
  input: { movement_id: string; file: { bytes: ArrayBuffer; type: string; size: number } },
): Promise<UseCaseResult> {
  return run(async () => {
    if (!input.movement_id) return fail("Falta el movimiento");
    validateReceipt(input.file);
    await receipts.attach(input.movement_id, input.file);
    return ok();
  });
}

export function receiptUrl(receipts: ReceiptStorage, movementId: string): Promise<UseCaseResult<{ url: string }>> {
  return run(async () => {
    const url = await receipts.urlOf(movementId);
    if (!url) return fail("Este movimiento no tiene comprobante");
    return ok({ url });
  });
}

export function removeReceipt(receipts: ReceiptStorage, movementId: string): Promise<UseCaseResult> {
  return run(async () => {
    await receipts.remove(movementId);
    return ok();
  });
}
