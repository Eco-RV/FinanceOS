/**
 * Dominio de Finance OS: reglas de negocio puras (ver `docs/dominio/`).
 *
 * Regla de la capa: nada de aquí importa Next, React, Supabase, Zod ni el
 * alias `@/`. Los imports internos son relativos con extensión `.ts` para que
 * `node --test` los corra sin compilar.
 */

export * from "./shared/errors.ts";
export * from "./shared/money.ts";
export * from "./shared/calendar.ts";
export * from "./shared/notices.ts";
export * from "./ledger/movement.ts";
export * from "./ledger/receipt.ts";
export * from "./ledger/spending.ts";
export * from "./cards/statement.ts";
export * from "./cards/multicurrency.ts";
export * from "./cards/minimum.ts";
export * from "./financing/installments.ts";
export * from "./financing/amortization.ts";
export * from "./financing/plan.ts";
export * from "./financing/members.ts";
export * from "./sharing/shared-expense.ts";
export * from "./coverage/coverage.ts";
export * from "./importing/merchant.ts";
export * from "./catalog/lifecycle.ts";
export * from "./loans/loan.ts";
export * from "./ledger/fresh-start.ts";
export * from "./account/profile.ts";
export * from "./plans/plan.ts";
export * from "./savings/goal.ts";
export * from "./banking/debit-card.ts";
export * from "./constellation/usdc.ts";
export * from "./constellation/family.ts";
export * from "./constellation/directory.ts";
export * from "./plans/reminders.ts";
