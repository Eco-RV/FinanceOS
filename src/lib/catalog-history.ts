import "server-only";

import type { LifecycleRepository } from "@/application";

/**
 * Ids que tienen historia (G5) y por eso se desactivan en vez de eliminarse.
 * El caso de uso vuelve a revisar al eliminar; esto solo elige qué botón
 * mostrar.
 */
export async function idsWithHistory(
  repo: Pick<LifecycleRepository, "historyCount">,
  ids: string[],
): Promise<Set<string>> {
  const counts = await Promise.all(
    ids.map((id) => repo.historyCount(id).catch(() => 1)),
  );
  return new Set(ids.filter((_, i) => counts[i] > 0));
}
