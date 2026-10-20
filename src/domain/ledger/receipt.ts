/**
 * G8 (3.1.0): comprobante adjunto a un movimiento (factura, recibo, foto del
 * voucher). JPG, PNG, WebP o PDF de hasta 5 MB. No cambia el movimiento.
 */

import { DomainError } from "../shared/errors.ts";

export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export function validateReceipt(file: { type: string; size: number }): void {
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) {
    throw new DomainError("G8", "El comprobante debe ser JPG, PNG, WebP o PDF");
  }
  if (!(file.size > 0)) throw new DomainError("G8", "El archivo está vacío");
  if (file.size > RECEIPT_MAX_BYTES) throw new DomainError("G8", "El comprobante pesa más de 5 MB");
}
