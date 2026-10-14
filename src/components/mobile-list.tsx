import type { ReactNode } from "react";

/** Contenedor de tarjetas apiladas, visible solo debajo de `sm` (alternativa a una <Table>). */
export function MobileList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 sm:hidden">{children}</div>;
}

/** Una fila de lista como tarjeta: título + acciones arriba, campos abajo. */
export function MobileCard({
  title,
  meta,
  actions,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col gap-2 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          {meta ? (
            <div className="text-xs text-muted-foreground">{meta}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
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
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
