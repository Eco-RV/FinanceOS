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
export * from "./ledger/movement.ts";
export * from "./cards/statement.ts";
export * from "./financing/installments.ts";
export * from "./financing/amortization.ts";
export * from "./coverage/coverage.ts";
export * from "./importing/merchant.ts";
