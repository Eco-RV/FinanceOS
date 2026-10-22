import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION } from "@/lib/sentry-options";

/**
 * 3.2.0 · Fase 4: Sentry en el servidor (Node y Edge). Solo con
 * `NEXT_PUBLIC_SENTRY_DSN`; sin él no se inicia nada. No se envían datos
 * del usuario ni del request: solo el error y su traza (`SENTRY_DATA_COLLECTION`).
 */
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    dataCollection: SENTRY_DATA_COLLECTION,
    // Fase 1: tiempos de las páginas en producción (10 % de los requests).
    tracesSampleRate: 0.1,
  });
}

/** Errores de render, Server Actions y rutas del servidor. */
export const onRequestError = Sentry.captureRequestError;
