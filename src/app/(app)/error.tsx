"use client";

import { ErrorState } from "@/components/error-state";

/** 3.2.0 · Fase 4: error dentro de la app (con la barra de navegación). */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState error={error} retry={retry} />;
}
