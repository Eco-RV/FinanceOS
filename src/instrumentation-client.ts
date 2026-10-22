import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-options";

/**
 * 3.2.0 · Fase 4: Sentry en el navegador. Solo con `NEXT_PUBLIC_SENTRY_DSN`.
 * Sin datos del usuario ni grabación de sesión: solo errores y tiempos de
 * navegación (10 %).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = dsn ? Sentry.captureRouterTransitionStart : undefined;
