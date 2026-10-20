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
  SharedExpenseRepository,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

/** L2: los pagos y el desembolso de un préstamo se gestionan desde Préstamos. */
const LOAN_MOVEMENT = "Este movimiento es de un préstamo: se gestiona desde Préstamos";
/** X6: el gasto de un compartido y el ingreso de un cobro se gestionan desde Gastos compartidos. */
const SHARED_INCOME = "Este ingreso es el pago de un gasto compartido: se gestiona desde Gastos compartidos";
const SHARED_EXPENSE_DELETE = "Este gasto está compartido: deja de compartirlo antes de eliminarlo";
const SHARED_EXPENSE_EDIT =
  "Este gasto está compartido: el monto, la moneda y el origen no cambian (deja de compartirlo primero)";

export type MovementDeps = {
  accounts: AccountRepository;
  cards: CardRepository;
  movements: MovementRepository;
  categories: CategoryRepository;
  debitCards: DebitCardRepository;
  exchangeRates: ExchangeRateRepository;
  sharedExpenses: SharedExpenseRepository;
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
export type SaveMovementOutput = { affectedCardIds: string[]; id: string };

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

    // X6: lo compartido no cambia monto, moneda ni origen; el ingreso de un cobro no se edita aquí.
    const link = input.id ? await deps.sharedExpenses.linkOf(input.id) : null;
    if (link?.role === "income") return fail(SHARED_INCOME, "X6");
    if (link?.role === "expense") {
      const before = await deps.sharedExpenses.source(input.id!);
      const same =
        before &&
        input.type === before.type &&
        Number(input.amount) === Number(before.amount) &&
        currency === before.currency &&
        (input.account_id ?? null) === before.account_id &&
        (input.card_id ?? null) === (before.card?.id ?? null);
      if (!same) return fail(SHARED_EXPENSE_EDIT, "X6");
    }

    let id: string;
    if (input.id) {
      const previousCard = await deps.movements.cardIdOf(input.id);
      if (previousCard) affected.add(previousCard);
      await deps.movements.update(input.id, values);
      id = input.id;
    } else {
      id = (await deps.movements.create(values)).id;
    }

    return ok({ affectedCardIds: [...affected], id });
  });
}

/** Elimina un movimiento; el saldo se revierte en la persistencia. */
export function deleteMovement(
  deps: Pick<MovementDeps, "movements" | "sharedExpenses">,
  id: string,
): Promise<UseCaseResult<SaveMovementOutput>> {
  return run(async () => {
    if (await deps.movements.loanIdOf(id)) return fail(LOAN_MOVEMENT, "L2");
    const link = await deps.sharedExpenses.linkOf(id);
    if (link) return fail(link.role === "income" ? SHARED_INCOME : SHARED_EXPENSE_DELETE, "X6");
    const cardId = await deps.movements.cardIdOf(id);
    await deps.movements.delete(id);
    return ok({ affectedCardIds: cardId ? [cardId] : [], id });
  });
}
