import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { crToday, toISODate } from "@/domain";
import { refreshExchangeRate, syncPlans } from "@/application";
import { repositories } from "@/infrastructure/container";
import { timed } from "@/lib/perf";
import { getUser } from "@/lib/auth";

/**
 * M7 (2.7.0): registra las ocurrencias de los planes que ya llegaron. Una vez
 * por request (layout y página la piden; se ejecuta una sola vez). Nunca
 * rompe la página: sin el SQL 2.7.0 no hace nada.
 */
export const ensurePlansUpToDate = cache(async (): Promise<number> =>
  timed("sync:planes", async () => {
    try {
      const { plans } = await repositories();
      const result = await syncPlans(plans, toISODate(crToday()));
      return result.ok ? result.value.registered : 0;
    } catch {
      return 0;
    }
  }),
);

/**
 * T10 (3.1.0): trae el tipo de cambio de hoy del BCCR (vía Hacienda) si el
 * último guardado es de otro día. Una vez por request y nunca rompe la
 * página: si la API no responde, se sigue con el último guardado.
 */
export const ensureExchangeRateToday = cache(async (): Promise<void> =>
  timed("sync:tipo-cambio", async () => {
    try {
      const repos = await repositories();
      await refreshExchangeRate(repos, { today: toISODate(crToday()) });
    } catch {
      // Sin red o sin sesión: queda el último tipo de cambio.
    }
  }),
);

/** Cookie que marca la última sincronización del día: `<id del usuario>:<YYYY-MM-DD>`. */
export const DAILY_SYNC_COOKIE = "fo-sync";

/**
 * 3.2.0 · Fase 1.2: planes (M7) y tipo de cambio (T10) se sincronizan **una
 * vez al día por usuario y dispositivo**, no en cada página. La primera visita
 * del día (en Costa Rica) espera la sincronización antes de leer, para que
 * los saldos ya traigan lo que llegó hoy; las demás solo leen la cookie, sin
 * consultar nada. `DailySyncMark` guarda la cookie en el navegador cuando el
 * render sí sincronizó. Planes y cada acción siguen sincronizando siempre.
 */
export const ensureDailySync = cache(async (): Promise<{ ran: boolean; mark: string }> => {
  const [user, jar] = await Promise.all([getUser(), cookies()]);
  const mark = `${user?.id ?? ""}:${toISODate(crToday())}`;
  if (!user || jar.get(DAILY_SYNC_COOKIE)?.value === mark) return { ran: false, mark };
  await Promise.all([ensurePlansUpToDate(), ensureExchangeRateToday()]);
  return { ran: true, mark };
});
