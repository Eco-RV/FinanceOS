"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CalendarDays, CalendarRange, ChevronRight, Receipt } from "lucide-react";
import { CategoryBadge } from "@/components/category-icon";
import { formatCurrency } from "@/lib/format";
import { defaultIconFor, type CategoryIconKey } from "@/lib/category-icon-keys";
import { cn } from "@/lib/utils";
import { FOCUS_OUTLINE } from "@/lib/interactive";

/** Un gasto en colones ya ocurrido: fecha ISO, monto y categoría. */
export type ExpensePoint = { d: string; a: number; c: string | null };

type Period = "week" | "month" | "year";

const PERIODS: { key: Period; label: string; short: string; long: string; icon: typeof Receipt }[] = [
  { key: "week", label: "Últimos 7 días", short: "7 días", long: "los últimos 7 días", icon: CalendarDays },
  { key: "month", label: "Este mes", short: "Mes", long: "este mes", icon: Receipt },
  { key: "year", label: "Este año", short: "Año", long: "este año", icon: CalendarRange },
];

const BAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-muted-foreground/50",
];

const MAX_BARS = 6;

/** Enlace a Gastos con el período (y la categoría) ya filtrados. */
function gastosHref(from: string, to: string, category?: string): string {
  const q = new URLSearchParams({ desde: from, hasta: to });
  if (category) q.set("categoria", category);
  return `/procesos/gastos?${q}`;
}

function minus(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d - days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Gastos del Resumen (2.5.0). Fila de tres cards (7 días, mes, año) que
 * eligen la vista, y debajo una card grande con el total y las barras por
 * categoría, de la más usada a la menos (las de más allá de la sexta van en
 * "Otras"). Solo colones, igual que el resto del Resumen.
 */
export function ExpenseOverview({
  points,
  todayISO,
  icons,
  hasUsd,
}: {
  points: ExpensePoint[];
  todayISO: string;
  icons: Record<string, CategoryIconKey>;
  hasUsd: boolean;
}) {
  const [period, setPeriod] = useState<Period>("month");

  const starts: Record<Period, string> = useMemo(
    () => ({
      week: minus(todayISO, 6),
      month: `${todayISO.slice(0, 7)}-01`,
      year: `${todayISO.slice(0, 4)}-01-01`,
    }),
    [todayISO],
  );

  const totals = useMemo(() => {
    const out = { week: 0, month: 0, year: 0 } as Record<Period, number>;
    for (const p of points) {
      for (const k of Object.keys(out) as Period[]) if (p.d >= starts[k]) out[k] += p.a;
    }
    return out;
  }, [points, starts]);

  const bars = useMemo(() => {
    const by = new Map<string, number>();
    for (const p of points) {
      if (p.d < starts[period]) continue;
      const name = p.c?.trim() || "Sin categoría";
      by.set(name, (by.get(name) ?? 0) + p.a);
    }
    const sorted = [...by].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, MAX_BARS - 1);
    const rest = sorted.slice(MAX_BARS - 1);
    // `category`: la de verdad (para filtrar en Gastos); null en "Otras" y "Sin categoría".
    const row = ([name, amount]: [string, number]) => ({
      name,
      amount,
      other: false,
      category: name === "Sin categoría" ? null : name,
    });
    const rows = top.map(row);
    if (rest.length === 1) rows.push(row(rest[0]));
    else if (rest.length > 1)
      rows.push({
        name: `Otras (${rest.length})`,
        amount: rest.reduce((s, r) => s + r[1], 0),
        other: true,
        category: null,
      });
    return rows;
  }, [points, starts, period]);

  const total = totals[period];
  const max = Math.max(...bars.map((b) => b.amount), 1);
  const current = PERIODS.find((p) => p.key === period)!;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:col-span-3">
      {PERIODS.map((p, i) => {
        const selected = p.key === period;
        const Icon = p.icon;
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={selected}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "surface rise flex min-w-0 flex-col gap-1 p-3 text-left transition-[box-shadow,background-color,translate,scale] duration-200 ease-fluid motion-safe:active:scale-[0.985] sm:gap-2 sm:p-5",
              selected
                ? "ring-2 ring-foreground/80 dark:ring-foreground/70"
                : "hover:shadow-card-hover motion-safe:hover:-translate-y-px",
            )}
            style={{ "--rise-i": 7 + i } as CSSProperties}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
              <Icon className="hidden size-4 sm:block" />
              <span className="sm:hidden">{p.short}</span>
              <span className="hidden sm:inline">Gastos · {p.label}</span>
            </span>
            <span className="truncate text-base font-semibold tracking-tight tabular-nums sm:text-2xl">
              {formatCurrency(totals[p.key])}
            </span>
          </button>
        );
      })}
      </div>

      <section
        className="surface rise group/chart relative flex flex-col gap-5 p-4 transition-[box-shadow,translate] duration-200 ease-fluid hover:shadow-card-hover sm:p-6 lg:col-span-3"
        style={{ "--rise-i": 10 } as CSSProperties}
        aria-label="Gastos por categoría"
      >
        {/* 2.5.0: toda la card abre Gastos con el período ya filtrado. */}
        <Link
          href={gastosHref(starts[period], todayISO)}
          aria-label={`Ver los gastos de ${current.long}`}
          className={cn("absolute inset-0 rounded-xl", FOCUS_OUTLINE)}
        />
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">Gastos por categoría · {current.long}</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(total)}
            </p>
          </div>
          <span className="flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover/chart:text-foreground">
            {hasUsd ? <span className="mr-2 text-xs">Solo gastos en colones.</span> : null}
            Ver en Gastos
            <ChevronRight className="size-4 transition-[translate] duration-200 ease-fluid motion-safe:group-hover/chart:translate-x-0.5" />
          </span>
        </div>

        {bars.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin gastos en {current.long}.
          </p>
        ) : (
          <ul className="grid gap-x-10 gap-y-1 lg:grid-cols-2">
            {bars.map((b, i) => {
              const pct = total > 0 ? Math.round((b.amount / total) * 100) : 0;
              const icon = b.other
                ? ("tag" as CategoryIconKey)
                : (icons[b.name.toLowerCase()] ?? defaultIconFor(b.name));
              const body = (
                <>
                  <CategoryBadge icon={icon} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{b.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatCurrency(b.amount)}
                        <span className="ml-1.5 text-xs text-muted-foreground">{pct}%</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        data-motion
                        className={cn("h-full origin-left rounded-full", BAR_COLORS[i % BAR_COLORS.length])}
                        style={{
                          width: `${Math.max(2, (b.amount / max) * 100)}%`,
                          animation: `grow-x 700ms var(--ease-fluid) ${i * 60}ms both`,
                        }}
                      />
                    </div>
                  </div>
                </>
              );
              return (
                <li key={`${period}:${b.name}`}>
                  {b.category ? (
                    // Cada barra abre Gastos filtrado por su categoría.
                    <Link
                      href={gastosHref(starts[period], todayISO, b.category)}
                      aria-label={`Ver los gastos de ${b.name} en ${current.long}`}
                      className={cn(
                        "relative z-10 -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-muted/70",
                        FOCUS_OUTLINE,
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-1.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
