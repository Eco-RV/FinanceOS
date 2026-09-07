import type { Category } from "@/lib/types";

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
