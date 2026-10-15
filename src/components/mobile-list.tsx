import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { FOCUS_OUTLINE } from "@/lib/interactive";
import { cn } from "@/lib/utils";

/** Contenedor de tarjetas apiladas, visible solo debajo de `sm` (alternativa a `RowList`). */
export function MobileList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 sm:hidden">{children}</div>;
}

/**
 * Una fila de lista como tarjeta: título + acciones arriba, campos abajo.
 * Con `href` (2.5.0) toda la tarjeta abre el detalle, salvo las acciones.
 */
export function MobileCard({
  title,
  meta,
  actions,
  children,
  href,
  label,
  index,
}: {
  index?: number;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "surface relative flex flex-col gap-2 p-3.5",
        index != null && "rise",
        href && "transition-[background-color,scale] duration-150 ease-fluid active:bg-muted/60 motion-safe:active:scale-[0.99]",
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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          {meta ? (
            <div className="text-xs text-muted-foreground">{meta}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="relative z-10 flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
      </div>
      {children ? <div className="flex flex-col gap-1">{children}</div> : null}
    </div>
  );
}

/** Fila "label: valor" dentro de un MobileCard. */
export function MobileField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}
