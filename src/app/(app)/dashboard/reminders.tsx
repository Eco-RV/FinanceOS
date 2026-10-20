import Link from "next/link";
import { AlarmClock, CheckCircle2, ChevronRight } from "lucide-react";
import type { Reminder } from "@/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { PRESSABLE_ROW } from "@/lib/interactive";
import { cn } from "@/lib/utils";

/**
 * P8 (3.1.0): recordatorios dentro de la app. Va como una card más de la
 * grilla del Resumen (ley 03: nada con forma de banner) y cada fila lleva a
 * donde se resuelve.
 */
export function Reminders({ items, style }: { items: Reminder[]; style?: React.CSSProperties }) {
  return (
    <section className="surface rise flex flex-col gap-2 p-4 sm:p-5" style={style} aria-label="Recordatorios">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <AlarmClock className="size-4" /> Recordatorios
      </p>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" /> Nada pendiente en los próximos días.
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {items.slice(0, 6).map((r, i) => (
            <li key={`${r.kind}:${r.title}:${i}`}>
              <Link href={r.href} className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm", PRESSABLE_ROW)}>
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                {r.amount != null && r.currency ? (
                  <span className="shrink-0 tabular-nums">{formatCurrency(r.amount, r.currency)}</span>
                ) : null}
                {r.on ? <span className="shrink-0 text-xs text-muted-foreground">{formatDate(r.on)}</span> : null}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
