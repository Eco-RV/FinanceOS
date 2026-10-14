import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Superficie para listas y tablas (2.4.0): fondo de card, borde suave y
 * sombra, con separadores entre filas. Reemplaza el `rounded-lg border` suelto.
 */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "overflow-hidden rounded-xl bg-card text-card-foreground shadow-card ring-1 ring-foreground/6 dark:ring-foreground/10",
        className,
      )}
      {...props}
    />
  );
}
