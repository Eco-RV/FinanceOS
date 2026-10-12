/**
 * Ciclo de vida de lo que el usuario da de alta: cuentas, tarjetas,
 * categorías y bancos (ver `docs/dominio/reglas.md`).
 *
 *   G4 — No se registra nada sobre algo desactivado.
 *   G5 — Lo que tiene historia se **desactiva**; lo que no tiene, se puede
 *        **eliminar**. Eliminar algo con historia se rechaza: borraría (en
 *        cascada) o dejaría huérfanos sus movimientos.
 *
 * "Historia" según el tipo:
 *   cuenta    movimientos propios (origen o destino), sin contar su saldo inicial
 *   tarjeta   movimientos propios sin contar su saldo inicial, y financiamientos
 *   categoría movimientos del mismo tipo con ese nombre (sin distinguir mayúsculas)
 *   banco     avisos importados desde sus correos (pendientes, en cualquier estado)
 *   préstamo  cuotas pagadas (el desembolso no cuenta: es parte del alta)
 *
 * El saldo inicial no cuenta como historia: es parte del alta (C1). Una cuenta
 * creada por error con su saldo inicial se puede eliminar.
 */

import { DomainError } from "../shared/errors.ts";

export type CatalogKind = "account" | "card" | "category" | "bank" | "loan";

const SUBJECT: Record<CatalogKind, string> = {
  account: "La cuenta",
  card: "La tarjeta",
  category: "La categoría",
  bank: "El banco",
  loan: "El préstamo",
};

const HISTORY: Record<CatalogKind, string> = {
  account: "movimientos",
  card: "movimientos o financiamientos",
  category: "movimientos",
  bank: "avisos importados",
  loan: "cuotas pagadas",
};

/** Pronombre enclítico y terminación según el género del sustantivo. */
const LA: Record<CatalogKind, "la" | "lo"> = {
  account: "la",
  card: "la",
  category: "la",
  bank: "lo",
  loan: "lo",
};

/** G5: se puede eliminar solo si no tiene historia. */
export function canDelete(historyCount: number): boolean {
  return historyCount <= 0;
}

/** G5: rechaza eliminar algo con historia; hay que desactivarlo. */
export function assertCanDelete(kind: CatalogKind, name: string, historyCount: number): void {
  if (canDelete(historyCount)) return;
  throw new DomainError(
    "G5",
    `${SUBJECT[kind]} "${name}" tiene ${HISTORY[kind]}: desactíva${LA[kind]} en vez de eliminar${LA[kind]}.`,
  );
}

/** G4: rechaza registrar o editar sobre algo desactivado. */
export function assertActive(kind: CatalogKind, name: string, archived: boolean): void {
  if (!archived) return;
  throw new DomainError(
    "G4",
    `${SUBJECT[kind]} "${name}" está desactivad${LA[kind].slice(1)}: actíva${LA[kind]} primero.`,
  );
}

/** Compara nombres de categoría como lo hace la base (sin mayúsculas ni espacios extremos). */
export function sameCategoryName(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/**
 * G4 para categorías: un movimiento no puede usar una categoría desactivada.
 * Al editar, se permite conservar la categoría que el movimiento ya tenía
 * (para corregir el monto o la fecha de un movimiento viejo).
 */
export function assertCategoryUsable(input: {
  category: string | null;
  /** La categoría está desactivada y no hay una activa con el mismo nombre. */
  deactivated: boolean;
  /** Categoría que el movimiento tenía antes (al editar). */
  previous?: string | null;
}): void {
  const { category, deactivated, previous } = input;
  if (!category || !deactivated) return;
  if (previous != null && sameCategoryName(previous, category)) return;
  assertActive("category", category.trim(), true);
}
