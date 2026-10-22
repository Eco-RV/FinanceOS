import { BackLink } from "@/components/back-link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * 3.2.0 · Fase 1.2: esqueleto de carga con la forma de la página que viene.
 * Cada sección tiene su `loading.tsx` con uno de estos, así el toque cambia
 * de pantalla al instante (con el título real y el "regresar") en vez de
 * dejarla congelada hasta que llegan los datos.
 *
 * - `list`: encabezado + filas (Tarjetas, Cuentas, Gastos…).
 * - `detail`: encabezado + tarjeta grande + filas (detalle de tarjeta, cuenta…).
 * - `index`: encabezado + grilla de accesos (Procesos, Ajustes).
 * - `dashboard`: cifras + gráfico + filas (Resumen).
 */
type Variant = "list" | "detail" | "index" | "dashboard";

export function PageSkeleton({
  title,
  back,
  variant = "list",
  action = false,
  stats = 0,
  rows = 5,
  narrow = false,
}: {
  title?: string;
  back?: { href: string; label: string };
  variant?: Variant;
  /** Botón principal a la derecha del título (p. ej. "Nueva tarjeta"). */
  action?: boolean;
  /** Cantidad de cifras en la fila de resumen. */
  stats?: number;
  rows?: number;
  /** Página angosta (`max-w-3xl`), como las de Ajustes. */
  narrow?: boolean;
}) {
  return (
    <div
      className={cn("flex flex-col gap-6", narrow && "mx-auto w-full max-w-3xl")}
      aria-busy="true"
      aria-label="Cargando"
    >
      {back ? <BackLink href={back.href} label={back.label} /> : null}

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          {title ? (
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          ) : (
            <Skeleton className="h-8 w-48" />
          )}
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        {action ? <Skeleton className="h-9 w-28 shrink-0 rounded-lg" /> : null}
      </div>

      {variant === "detail" ? <Skeleton className="aspect-[1.6] w-full max-w-sm rounded-2xl" /> : null}

      {stats > 0 ? (
        <div className={cn("grid gap-4", stats >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="surface flex flex-col gap-3 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "dashboard" ? <Skeleton className="h-56 w-full rounded-2xl" /> : null}

      {variant === "index" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="surface flex items-center gap-4 p-4">
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="surface overflow-hidden">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
