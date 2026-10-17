/** Casos de uso del libro de movimientos: gasto (incl. SINPE), ingreso, abono y transferencia. */

import {
  assertCategoryUsable,
  assertDebitCardUsable,
  cardPaymentConversion,
  normalizeSinpePhone,
  validateMovement,
  type Currency,
  type ISODate,
  type MovementChannel,
  type MovementType,
} from "../domain/index.ts";
import type {
  AccountRepository,
  CardRepository,
  CategoryRepository,
  DebitCardRepository,
  ExchangeRateRepository,
  MovementRepository,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

/** L2: los pagos y el desembolso de un préstamo se gestionan desde Préstamos. */
const LOAN_MOVEMENT = "Este movimiento es de un préstamo: se gestiona desde Préstamos";

export type MovementDeps = {
  accounts: AccountRepository;
  cards: CardRepository;
  movements: MovementRepository;
  categories: CategoryRepository;
  debitCards: DebitCardRepository;
  exchangeRates: ExchangeRateRepository;
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
  /**
   * Moneda de un cargo con tarjeta (T1); en cuentas manda la de la cuenta. En
   * un abono, el saldo de la tarjeta que baja (M5): si no es la de la cuenta,
   * se convierte con el último tipo de cambio.
   */
  currency?: Currency | null;
  /** Gasto de cuenta pagado con su tarjeta de débito (2.8.0). */
  debit_card_id?: string | null;
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
    const debitCardId = input.type === "expense" ? (input.debit_card_id ?? null) : null;
    // M5: abono en la otra moneda de la tarjeta → hace falta el tipo de cambio.
    const crossCurrencyPayment =
      input.type === "card_payment" && Boolean(input.currency) && input.currency !== accountCurrency;
    const rate = crossCurrencyPayment ? await deps.exchangeRates.latest() : null;
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
      usdCrc: rate?.usd_crc ?? null,
      debitCard: Boolean(debitCardId),
    });
    const isSinpe = channel === "sinpe";

    // G4/C3: la tarjeta de débito está activa y es de la cuenta (al editar se
    // puede conservar la que ya tenía aunque esté desactivada).
    if (debitCardId) {
      const card = await deps.debitCards.find(debitCardId);
      const previous = input.id ? await deps.movements.debitCardOf(input.id) : null;
      assertDebitCardUsable(
        card && previous === debitCardId ? { ...card, archived: false } : card,
        input.account_id,
      );
    }

    const conversion =
      input.type === "card_payment" && accountCurrency
        ? cardPaymentConversion({
            amount: input.amount,
            paymentCurrency: currency,
            accountCurrency,
            usdCrc: rate?.usd_crc ?? null,
          })
        : { account_amount: null, exchange_rate: null };

    // G4: no se usa una categoría desactivada (al editar, se puede conservar).
    const categoryKind =
      input.type === "expense" ? "expense" : input.type === "income" ? "income" : null;
    if (categoryKind && input.category) {
      const [deactivated, previous] = await Promise.all([
        deps.categories.isDeactivated(categoryKind, input.category),
        input.id ? deps.movements.categoryOf(input.id) : null,
      ]);
      assertCategoryUsable({ category: input.category, deactivated, previous });
    }

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
      debit_card_id: debitCardId,
      account_amount: conversion.account_amount,
      exchange_rate: conversion.exchange_rate,
    };

    const affected = new Set<string>();
    if (input.card_id) affected.add(input.card_id);

    if (input.id && (await deps.movements.loanIdOf(input.id))) return fail(LOAN_MOVEMENT, "L2");

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
    if (await deps.movements.loanIdOf(id)) return fail(LOAN_MOVEMENT, "L2");
    const cardId = await deps.movements.cardIdOf(id);
    await deps.movements.delete(id);
    return ok({ affectedCardIds: cardId ? [cardId] : [] });
  });
}
