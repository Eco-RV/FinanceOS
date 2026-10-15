import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { FOCUS_OUTLINE } from "@/lib/interactive";
import { cn } from "@/lib/utils";

/**
 * Lista de filas separadas para escritorio (2.5.0): reemplaza la <Table>
 * "todo pegado" por una card por fila, con el mismo aire que la vista móvil
 * (`MobileList`). Las columnas se definen una vez (`columns`, un
 * `grid-template-columns`) y valen para el encabezado y cada fila. Visible
 * desde `sm`; debajo se usa `MobileList`.
 */

export type RowHeader = { label?: string; align?: "left" | "right" };

export function RowList({
  columns,
  headers,
  children,
  className,
}: {
  columns: string;
  headers: RowHeader[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("hidden flex-col gap-2 sm:flex", className)}
      style={{ "--row-cols": columns } as CSSProperties}
    >
      <div className="grid grid-cols-(--row-cols) items-end gap-4 px-4 pb-0.5 text-xs font-medium text-muted-foreground">
        {headers.map((h, i) => (
          <span key={i} className={cn("truncate", h.align === "right" && "text-right")}>
            {h.label}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

/**
 * Una fila. Con `href` toda la fila abre el detalle (enlace estirado); las
 * acciones van dentro de `RowActions`, que queda por encima del enlace.
 */
export function RowItem({
  href,
  label,
  children,
  className,
  muted = false,
  index,
}: {
  /** Posición en la lista: la fila entra en cascada (animación `rise`). */
  index?: number;
  href?: string;
  /** Nombre accesible del enlace de la fila. */
  label?: string;
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface group/row relative grid grid-cols-(--row-cols) items-center gap-4 px-4 py-3 text-sm",
        href &&
          "transition-[translate,box-shadow,background-color] duration-200 ease-fluid hover:bg-muted/40 hover:shadow-card-hover motion-safe:hover:-translate-y-px",
        muted && "opacity-70",
        index != null && "rise",
        className,
      )}
      style={index != null ? ({ "--rise-i": Math.min(index, 12) } as CSSProperties) : undefined}
    >
      {href ? (
        <Link
          href={href}
          aria-label={label}
          className={cn("absolute inset-0 rounded-xl", FOCUS_OUTLINE)}
        />
      ) : null}
      {children}
    </div>
  );
}

/** Botones de una fila (editar, eliminar…): por encima del enlace de la fila. */
export function RowActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative z-10 flex items-center justify-end gap-1", className)}>
      {children}
    </div>
  );
}

/** Estado vacío con la misma superficie. */
export function EmptyRows({ children }: { children: ReactNode }) {
  return (
    <div className="surface px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
