"use client";

import { useState, useSyncExternalStore } from "react";

export const PAGE_SIZES = [5, 10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number] | "all";

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseSize(v: string | null): PageSize | null {
  try {
    if (v === "all") return "all";
    const n = Number(v);
    return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * Paginación en el cliente (3.1.0): filas por página (5, 10, 20, 50 o todas)
 * recordadas por lista en este navegador, y la página actual. Llamar `reset()`
 * cuando cambian los filtros.
 */
export function usePagination<T>(items: T[], storageKey: string, initialSize: PageSize = 10) {
  // En el servidor no hay preferencia guardada: pinta el tamaño inicial y, al
  // hidratar, el guardado (useSyncExternalStore evita el desajuste).
  const saved = useSyncExternalStore(
    subscribe,
    () => readRaw(storageKey),
    () => null,
  );
  const [chosen, setChosen] = useState<PageSize | null>(null);
  const pageSize = chosen ?? parseSize(saved) ?? initialSize;
  const [page, setPage] = useState(0);

  const setPageSize = (size: PageSize) => {
    setChosen(size);
    setPage(0);
    try {
      window.localStorage.setItem(storageKey, String(size));
    } catch {
      // Sin almacenamiento (modo privado): solo dura esta visita.
    }
  };

  const size = pageSize === "all" ? Math.max(items.length, 1) : pageSize;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);

  return {
    visible: items.slice(current * size, current * size + size),
    reset: () => setPage(0),
    footer: {
      total: items.length,
      pageSize,
      setPageSize,
      from: items.length === 0 ? 0 : current * size + 1,
      to: Math.min(items.length, current * size + size),
      canPrev: current > 0,
      canNext: current < pages - 1,
      prev: () => setPage(current - 1),
      next: () => setPage(current + 1),
    },
  };
}

export type PaginationState = ReturnType<typeof usePagination>["footer"];
