/** Casos de uso del libro de movimientos: gasto (incl. SINPE), ingreso, abono y transferencia. */

import {
  normalizeSinpePhone,
  validateMovement,
  type Currency,
  type ISODate,
  type MovementChannel,
  type MovementType,
} from "../domain/index.ts";
import type { AccountRepository, CardRepository, MovementRepository } from "./ports.ts";
import { ok, run, type UseCaseResult } from "./result.ts";

export type MovementDeps = {
  accounts: AccountRepository;
  cards: CardRepository;
  movements: MovementRepository;
};

export type SaveMovementInput = {
  /** `null` para crear, id para editar. */
  id: string | null;
  type: MovementType;
  amount: number;
  occurred_on: ISODate;
  category: string | null;
  note: string | null;
  account_id: string | null;
  card_id: string | null;
  /** Cuenta destino (solo transferencias). */
  to_account_id?: string | null;
  /** Moneda de un cargo con tarjeta (T1); en cuentas manda la de la cuenta. */
  currency?: Currency | null;
  /** Gasto por SINPE, con destinatario y teléfono opcionales. */
  channel?: MovementChannel | null;
  counterparty_name?: string | null;
  counterparty_phone?: string | null;
};

/** Tarjetas afectadas (la nueva y, al editar, la anterior), para refrescar vistas. */
export type SaveMovementOutput = { affectedCardIds: string[] };

/**
 * Registra o edita un movimiento. Aplica las reglas M1/M2/M3/M5/S1 del dominio y
 * copia la moneda del origen. El saldo lo ajusta la persistencia (hoy el
 * trigger de Postgres) con la misma convención de `balanceEffects`.
 */
export function saveMovement(
  deps: MovementDeps,
  input: SaveMovementInput,
): Promise<UseCaseResult<SaveMovementOutput>> {
  return run(async () => {
    const [accountCurrency, cardCurrency, toAccountCurrency] = await Promise.all([
      input.account_id ? deps.accounts.currencyOf(input.account_id) : null,
      input.card_id ? deps.cards.currencyOf(input.card_id) : null,
      input.to_account_id ? deps.accounts.currencyOf(input.to_account_id) : null,
    ]);

    const channel = input.channel ?? null;
    const currency = validateMovement({
      type: input.type,
      amount: input.amount,
      category: input.category,
      accountCurrency,
      cardCurrency,
      currency: input.currency ?? null,
      accountId: input.account_id,
      toAccountId: input.to_account_id ?? null,
      toAccountCurrency,
      channel,
      counterpartyPhone: input.counterparty_phone ?? null,
    });
    const isSinpe = channel === "sinpe";

    const values = {
      type: input.type,
      amount: input.amount,
      currency,
      occurred_on: input.occurred_on,
      category: input.category,
      note: input.note,
      account_id: input.account_id,
      card_id: input.card_id,
      to_account_id: input.type === "transfer" ? (input.to_account_id ?? null) : null,
      channel,
      counterparty_name: isSinpe ? input.counterparty_name?.trim() || null : null,
      counterparty_phone: isSinpe ? normalizeSinpePhone(input.counterparty_phone) : null,
    };

    const affected = new Set<string>();
    if (input.card_id) affected.add(input.card_id);

    if (input.id) {
      const previousCard = await deps.movements.cardIdOf(input.id);
      if (previousCard) affected.add(previousCard);
      await deps.movements.update(input.id, values);
    } else {
      await deps.movements.create(values);
    }

    return ok({ affectedCardIds: [...affected] });
  });
}

/** Elimina un movimiento; el saldo se revierte en la persistencia. */
export function deleteMovement(
  deps: Pick<MovementDeps, "movements">,
  id: string,
): Promise<UseCaseResult<SaveMovementOutput>> {
  return run(async () => {
    const cardId = await deps.movements.cardIdOf(id);
    await deps.movements.delete(id);
    return ok({ affectedCardIds: cardId ? [cardId] : [] });
  });
}
