/**
 * Casos de uso del catálogo del usuario (cuentas, tarjetas, categorías y
 * bancos): eliminar o desactivar según G5 y no operar sobre lo desactivado
 * (G4). El guardado de cuentas y tarjetas vive en `products.ts` (lleva su
 * saldo inicial).
 */

import { assertActive, assertCanDelete, type CatalogKind } from "../domain/index.ts";
import type {
  BankFields,
  BankRepository,
  CategoryFields,
  CategoryKind,
  CategoryRepository,
  LifecycleRepository,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

const NOT_FOUND: Record<CatalogKind, string> = {
  account: "Cuenta no encontrada",
  card: "Tarjeta no encontrada",
  category: "Categoría no encontrada",
  bank: "Banco no encontrado",
  loan: "Préstamo no encontrado",
  member: "Miembro no encontrado",
  debitCard: "Tarjeta de débito no encontrada",
};

/** G5: elimina solo si no tiene historia; si tiene, hay que desactivarlo. */
export function removeFromCatalog(
  repo: LifecycleRepository,
  kind: CatalogKind,
  id: string,
): Promise<UseCaseResult> {
  return run(async () => {
    const entry = await repo.find(id);
    if (!entry) return fail(NOT_FOUND[kind]);
    assertCanDelete(kind, entry.name, await repo.historyCount(id));
    await repo.delete(id);
    return ok();
  });
}

/**
 * Desactiva (o reactiva) algo del catálogo. Desactivar conserva su historia y
 * sus saldos; solo deja de ofrecerse para registrar (G4).
 */
export function setCatalogActive(
  repo: LifecycleRepository,
  kind: CatalogKind,
  id: string,
  active: boolean,
): Promise<UseCaseResult> {
  return run(async () => {
    const entry = await repo.find(id);
    if (!entry) return fail(NOT_FOUND[kind]);
    if (entry.archived === !active) return ok();
    await repo.setArchived(id, !active);
    return ok();
  });
}

/** Crea o renombra una categoría. No se edita una desactivada (G4). */
export function saveCategory(
  categories: CategoryRepository,
  input: { id: string | null; fields: CategoryFields },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    if (input.id) {
      const current = await categories.find(input.id);
      if (!current) return fail(NOT_FOUND.category);
      assertActive("category", current.name, current.archived);
    }
    return ok(await categories.save(input.id, input.fields));
  });
}

/**
 * Carga la lista sugerida de un tipo sin duplicar: se salta cualquier nombre
 * que ya exista, aunque esté desactivado (desactivar es una decisión del
 * usuario y no se deshace en silencio).
 */
export function seedCategories(
  categories: CategoryRepository,
  kind: CategoryKind,
  suggested: readonly string[],
): Promise<UseCaseResult<{ added: number }>> {
  return run(async () => {
    const have = new Set((await categories.names(kind)).map((n) => n.trim().toLowerCase()));
    const rows = suggested
      .filter((name) => !have.has(name.trim().toLowerCase()))
      .map((name) => ({ kind, name }));
    if (rows.length > 0) await categories.createMany(rows);
    return ok({ added: rows.length });
  });
}

/** Crea o edita un banco. No se edita uno desactivado (G4). */
export function saveBank(
  banks: BankRepository,
  input: { id: string | null; fields: BankFields },
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    if (input.id) {
      const current = await banks.find(input.id);
      if (!current) return fail(NOT_FOUND.bank);
      assertActive("bank", current.name, current.archived);
    }
    return ok(await banks.save(input.id, input.fields));
  });
}
