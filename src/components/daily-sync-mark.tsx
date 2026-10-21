"use client";

import { useEffect } from "react";

/**
 * 3.2.0 · Fase 1.2: guarda que hoy ya se sincronizaron planes y tipo de cambio
 * (`ensureDailySync` en `src/lib/sync-plans.ts`). No pinta nada.
 */
export function DailySyncMark({ name, mark }: { name: string; mark: string }) {
  useEffect(() => {
    document.cookie = `${name}=${mark}; path=/; max-age=172800; samesite=lax`;
  }, [name, mark]);
  return null;
}
