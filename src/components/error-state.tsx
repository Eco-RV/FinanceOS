"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";

/**
 * 3.2.0 · Fase 4: lo que se ve cuando una pantalla falla. Explica qué hacer,
 * deja reintentar y volver al Resumen; el error se reporta (Sentry, si está).
 */
export function ErrorState({
  error,
  retry,
  home = "/dashboard",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  home?: string;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">
          No pudimos cargar esta pantalla. Tus datos están bien: intenta de nuevo y, si sigue pasando, cuéntanos en
          Comentarios.
        </p>
        {error.digest ? <p className="text-xs text-muted-foreground">Código: {error.digest}</p> : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw className="size-4" /> Intentar de nuevo
        </Button>
        <Link href={home} className={buttonVariants({ variant: "outline" })}>
          Ir al Resumen
        </Link>
      </div>
    </div>
  );
}
