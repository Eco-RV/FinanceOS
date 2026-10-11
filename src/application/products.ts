/**
 * Casos de uso de cuentas y tarjetas de crédito, con su **saldo inicial**
 * como movimiento (C1). El saldo guardado nunca se escribe a mano: lo derivan
 * los movimientos (G1).
 */

import { validateMovement, type Currency, type ISODate } from "../domain/index.ts";
import type {
  AccountFields,
  AccountRepository,
  CardFields,
  CardRepository,
  MovementRepository,
} from "./ports.ts";
import { ok, run, type UseCaseResult } from "./result.ts";

export type OpeningInput = {
  /** Con signo; 0 = sin saldo inicial. */
  amount: number;
  occurred_on: ISODate;
};

/**
 * Deja el saldo inicial de una cuenta o tarjeta en `opening`: lo crea, lo
 * actualiza o lo elimina (si es 0). Siempre en la moneda del producto.
 */
export async function setOpeningBalance(
  movements: MovementRepository,
  target: "account" | "card",
  id: string,
  currency: Currency,
  opening: OpeningInput,
): Promise<void> {
  const existing = await movements.openingOf(target, id, currency);
  const amount = Number(opening.amount) || 0;

  if (amount === 0) {
    if (existing) await movements.delete(existing.id);
    return;
  }

  validateMovement({
    type: "opening_balance",
    amount,
    accountCurrency: target === "account" ? currency : null,
    cardCurrency: target === "card" ? currency : null,
  });

  const values = {
    type: "opening_balance" as const,
    amount,
    currency,
    occurred_on: opening.occurred_on,
    category: null,
    note: "Saldo inicial",
    account_id: target === "account" ? id : null,
    card_id: target === "card" ? id : null,
  };

  if (existing) await movements.update(existing.id, values);
  else await movements.create(values);
}

export type AccountDeps = { accounts: AccountRepository; movements: MovementRepository };

export function saveAccount(
  deps: AccountDeps,
  input: { id: string | null; fields: AccountFields; opening: OpeningInput },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    const { id } = await deps.accounts.save(input.id, input.fields);
    try {
      await setOpeningBalance(deps.movements, "account", id, input.fields.currency, input.opening);
    } catch (e) {
      // Una cuenta nueva sin su saldo inicial no debe quedar a medias.
      if (!input.id) await deps.accounts.delete(id);
      throw e;
    }
    return ok({ id });
  });
}

export type CardDeps = { cards: CardRepository; movements: MovementRepository };

/** Saldo inicial de una tarjeta en una moneda (T1: puede tener en CRC y USD). */
export type CardOpening = OpeningInput & { currency: Currency };

export function saveCard(
  deps: CardDeps,
  input: { id: string | null; fields: CardFields; openings: CardOpening[] },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    const { id } = await deps.cards.save(input.id, input.fields);
    try {
      for (const o of input.openings) {
        await setOpeningBalance(deps.movements, "card", id, o.currency, o);
      }
    } catch (e) {
      if (!input.id) await deps.cards.delete(id);
      throw e;
    }
    return ok({ id });
  });
}
