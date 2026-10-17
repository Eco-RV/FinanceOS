/**
 * Tarjetas de débito (2.8.0, regla C3). Una tarjeta de débito pertenece a una
 * cuenta bancaria (corriente o ahorro), como máximo una activa por cuenta. No
 * tiene saldo propio: pagar con ella es un gasto de su cuenta.
 */

import { DomainError } from "../shared/errors.ts";

export type DebitCardFields = {
  name: string;
  last_four: string | null;
};

export type DebitCardEntry = {
  account_id: string;
  name: string;
  archived: boolean;
};

/** Tipos de cuenta que pueden tener tarjeta de débito (no el efectivo). */
export const DEBIT_CARD_ACCOUNT_TYPES = ["checking", "savings"] as const;

/** C3: nombre de 1 a 40 caracteres, últimos 4 dígitos opcionales, cuenta bancaria. */
export function validateDebitCard(fields: DebitCardFields, accountType: string): void {
  const name = fields.name.trim();
  if (!name || name.length > 40) {
    throw new DomainError("C3", "El nombre de la tarjeta lleva de 1 a 40 caracteres");
  }
  if (fields.last_four != null && !/^\d{4}$/.test(fields.last_four)) {
    throw new DomainError("C3", "Los últimos dígitos son 4 números");
  }
  if (!(DEBIT_CARD_ACCOUNT_TYPES as readonly string[]).includes(accountType)) {
    throw new DomainError("C3", "Solo una cuenta bancaria (corriente o de ahorro) tiene tarjeta de débito");
  }
}

/**
 * G4 + C3: para registrar un gasto (o un plan) con una tarjeta de débito, la
 * tarjeta existe, está activa y es de la cuenta del movimiento.
 */
export function assertDebitCardUsable(card: DebitCardEntry | null, accountId: string | null): void {
  if (!card) throw new DomainError("G4", "Tarjeta de débito no encontrada");
  if (card.archived) {
    throw new DomainError("G4", `La tarjeta de débito "${card.name}" está desactivada: actívala primero.`);
  }
  if (!accountId || card.account_id !== accountId) {
    throw new DomainError("C3", "La tarjeta de débito no es de esa cuenta");
  }
}

/** "Débito BCR ••1234" para listas y movimientos. */
export function debitCardLabel(card: { name: string; last_four: string | null }): string {
  return card.last_four ? `${card.name} ••${card.last_four}` : card.name;
}
