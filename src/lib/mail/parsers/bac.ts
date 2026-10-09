import { extractFields, htmlToLines, parseAmount } from "../html.ts";
import type { MailMessage, MailParser, ParsedTransaction } from "../types.ts";

const MONTHS: Record<string, string> = {
  jan: "01", ene: "01",
  feb: "02",
  mar: "03",
  apr: "04", abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08", ago: "08",
  sep: "09", set: "09",
  oct: "10",
  nov: "11",
  dec: "12", dic: "12",
};

/** "Oct 4, 2026, 18:38" → "2026-10-04". */
function parseBacDate(raw: string): string | null {
  const m = raw.match(/^([a-záéíóú]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[2].padStart(2, "0")}`;
}

/** Asunto "... 04-10-2026 - 18:38" (dd-mm-yyyy) como respaldo de la fecha. */
function dateFromSubject(subject: string): string | null {
  const m = subject.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Notificación de transacción de BAC Credomatic (tabla fija Etiqueta/Valor).
 * Solo las COMPRAS generan un gasto; reversos y otros tipos devuelven `null`.
 */
export const parseBac: MailParser = (message: MailMessage) => {
  const body = message.html ?? message.text;
  if (!body) return null;

  const fields = extractFields(
    message.html ? htmlToLines(body) : body.split("\n").map((l) => l.trim()),
  );

  if (fields.get("tipo de transaccion")?.toUpperCase() !== "COMPRA") return null;

  const merchant = fields.get("comercio");
  const montoRaw = fields.get("monto");
  if (!merchant || !montoRaw) return null;

  const currency = montoRaw.match(/\b(CRC|USD)\b/i)?.[1].toUpperCase();
  const amount = parseAmount(montoRaw);
  if (!currency || amount === null || amount <= 0) return null;

  const occurredOn =
    (fields.get("fecha") && parseBacDate(fields.get("fecha")!)) ||
    dateFromSubject(message.subject);
  if (!occurredOn) return null;

  // La etiqueta de la tarjeta cambia con la marca (AMEX/VISA/MASTERCARD):
  // se identifica por el valor enmascarado "****1234".
  let lastFour: string | null = null;
  for (const value of fields.values()) {
    const m = value.match(/^\*{4,}(\d{4})$/);
    if (m) {
      lastFour = m[1];
      break;
    }
  }

  const result: ParsedTransaction = {
    merchant: merchant.replace(/\s+/g, " ").trim(),
    amount,
    currency: currency as "CRC" | "USD",
    occurredOn,
    lastFour,
    authorization: fields.get("autorizacion") ?? null,
    reference: fields.get("referencia") ?? null,
  };
  return result;
};
