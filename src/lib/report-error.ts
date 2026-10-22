/**
 * 3.2.0 · Fase 4: reporta un error atrapado por una pantalla de error. Con
 * Sentry configurado (`NEXT_PUBLIC_SENTRY_DSN`) lo manda ahí; siempre queda en
 * la consola.
 */
export function reportError(error: unknown): void {
  console.error(error);
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
}
