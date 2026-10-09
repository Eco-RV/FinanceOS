/** Correo ya descargado del proveedor, listo para un parser. */
export type MailMessage = {
  /** Id del mensaje en el proveedor (dedupe). */
  id: string;
  from: string;
  subject: string;
  /** Cuerpo HTML si el correo lo trae; si no, `text`. */
  html: string | null;
  text: string | null;
};

export type ParsedTransaction = {
  merchant: string;
  amount: number;
  currency: "CRC" | "USD";
  /** "YYYY-MM-DD" */
  occurredOn: string;
  lastFour: string | null;
  authorization: string | null;
  reference: string | null;
};

/**
 * Contrato de cada parser de banco. Devuelve `null` si el correo no es un
 * gasto (p. ej. un reverso, un estado de cuenta o un formato desconocido).
 */
export type MailParser = (message: MailMessage) => ParsedTransaction | null;
