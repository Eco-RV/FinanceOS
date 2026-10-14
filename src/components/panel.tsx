import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Superficie para listas y tablas (2.4.0): fondo de card, borde suave y
 * sombra, con separadores entre filas. Usa la utilidad `surface` de `globals.css`.
 */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "surface overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}
