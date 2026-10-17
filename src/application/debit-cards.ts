/**
 * Tarjetas de débito (2.8.0, regla C3). Eliminar o desactivar sigue G5 con
 * `removeFromCatalog` / `setCatalogActive` (tipo "debitCard"): su historia son
 * los gastos pagados con ella.
 */

import { assertActive, DomainError, validateDebitCard } from "../domain/index.ts";
import type { AccountRepository, DebitCardInput, DebitCardRepository } from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

export type DebitCardDeps = {
  debitCards: DebitCardRepository;
  accounts: AccountRepository;
};

/**
 * Crea o edita la tarjeta de débito de una cuenta bancaria activa. No se edita
 * una desactivada (G4) ni se cambia de cuenta.
 */
export function saveDebitCard(
  deps: DebitCardDeps,
  input: { id: string | null; fields: DebitCardInput },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    const fields: DebitCardInput = {
      account_id: input.fields.account_id,
      name: input.fields.name.trim(),
      last_four: input.fields.last_four?.trim() || null,
    };
    const accountType = await deps.accounts.typeOf(fields.account_id);
    if (!accountType) throw new DomainError("G4", "Cuenta no encontrada o desactivada");
    validateDebitCard(fields, accountType);

    if (input.id) {
      const current = await deps.debitCards.find(input.id);
      if (!current) return fail("Tarjeta de débito no encontrada");
      assertActive("debitCard", current.name, current.archived);
      if (current.account_id !== fields.account_id) {
        return fail("Una tarjeta de débito no cambia de cuenta", "C3");
      }
    }
    return ok(await deps.debitCards.save(input.id, fields));
  });
}
