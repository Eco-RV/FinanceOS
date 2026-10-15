import type { Category } from "@/lib/types";
import { iconFor, type CategoryIconKey } from "@/lib/category-icon-keys";

/**
 * Nombres de categoría para un selector: las que configuró el usuario, o la
 * lista sugerida (`fallback`) si todavía no tiene ninguna de ese tipo.
 */
export function categoryNames(
  rows: Pick<Category, "name">[],
  fallback: readonly string[],
): string[] {
  return rows.length > 0 ? rows.map((r) => r.name) : [...fallback];
}

/** Categoría con su ícono (2.5.0), para el selector visual y las listas. */
export type CategoryOption = { name: string; icon: CategoryIconKey };

/** Como `categoryNames`, con el ícono guardado o el sugerido por el nombre. */
export function categoryOptions(
  rows: Pick<Category, "name" | "icon">[],
  fallback: readonly string[],
): CategoryOption[] {
  const list = rows.length > 0 ? rows : fallback.map((name) => ({ name, icon: null }));
  return list.map((r) => ({ name: r.name, icon: iconFor(r) }));
}

/** Nombre → ícono, para pintar movimientos (cuya categoría es texto libre). */
export function iconsByName(options: CategoryOption[]): Record<string, CategoryIconKey> {
  return Object.fromEntries(options.map((o) => [o.name.trim().toLowerCase(), o.icon]));
}
