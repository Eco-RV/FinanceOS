"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CalendarDays, CalendarRange, ChevronRight, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { CategoryBadge } from "@/components/category-icon";
import { formatCurrency } from "@/lib/format";
import { defaultIconFor, type CategoryIconKey } from "@/lib/category-icon-keys";
import { cn } from "@/lib/utils";
import { FOCUS_OUTLINE } from "@/lib/interactive";
import { compareSpending, spendingRanges, type RefPoint, type SpendingComparison } from "@/domain";

/** Un gasto ya en colones (G9: los de dólares vienen convertidos): fecha ISO, monto y categoría. */
export type ExpensePoint = RefPoint;

const PREVIOUS_LABEL: Record<Period, string> = {
  week: "los 7 días anteriores",
  month: "el mes pasado a esta fecha",
  year: "el año pasado a esta fecha",
};

/**
 * G10 (3.1.0): variación contra el período anterior. Gastar más se marca en
 * rojo y gastar menos en verde.
 */
function Change({ c, compact }: { c: SpendingComparison; compact?: boolean }) {
  if (c.previous === 0 && c.current === 0) return null;
  if (c.ratio === null) {
    return <span className="text-xs text-muted-foreground">{compact ? "nuevo" : "sin gastos antes"}</span>;
  }
  const up = c.delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", up ? "text-destructive" : "text-success")}>
      <Icon className="size-3.5" />
      {up ? "+" : ""}
      {Math.round(c.ratio * 100)} %
    </span>
  );
}

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

/**
 * Gastos del Resumen (2.5.0). Fila de tres cards (7 días, mes, año) que
 * eligen la vista, y debajo una card grande con el total y las barras por
 * categoría, de la más usada a la menos (las de más allá de la sexta van en
 * "Otras"). Todo en colones: desde 3.1.0 los gastos en dólares suman
 * convertidos (G9) y cada período se compara con el anterior (G10).
 */
export function ExpenseOverview({
  points,
  todayISO,
  icons,
  unconverted,
}: {
  points: ExpensePoint[];
  todayISO: string;
  icons: Record<string, CategoryIconKey>;
  /** G9: gastos en dólares que no suman (no hay tipo de cambio). */
  unconverted: number;
}) {
  const [period, setPeriod] = useState<Period>("month");

  // G10 (3.1.0): período actual y anterior equivalente, desde el dominio.
  const ranges = useMemo(() => spendingRanges(todayISO), [todayISO]);
  const starts: Record<Period, string> = {
    week: ranges.week.current.from,
    month: ranges.month.current.from,
    year: ranges.year.current.from,
  };

  const comparisons = useMemo(
    () => ({
      week: compareSpending(points, ranges.week),
      month: compareSpending(points, ranges.month),
      year: compareSpending(points, ranges.year),
    }),
    [points, ranges],
  );
  const totals: Record<Period, number> = {
    week: comparisons.week.current,
    month: comparisons.month.current,
    year: comparisons.year.current,
  };

  const bars = useMemo(() => {
    const by = new Map<string, number>();
    for (const p of points) {
      if (p.d < ranges[period].current.from || p.d > todayISO) continue;
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
    return rows.map((row) => ({
      ...row,
      change: row.other ? null : compareSpending(points, ranges[period], row.category),
    }));
  }, [points, period, ranges, todayISO]);

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
            <Change c={comparisons[p.key]} compact />
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
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <Change c={comparisons[period]} />
              <span>
                vs. {formatCurrency(comparisons[period].previous)} en {PREVIOUS_LABEL[period]}
              </span>
            </p>
          </div>
          <span className="flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover/chart:text-foreground">
            {unconverted > 0 ? (
              <span className="mr-2 text-xs">
                {unconverted} gasto{unconverted === 1 ? "" : "s"} en dólares sin tipo de cambio no suma{unconverted === 1 ? "" : "n"}.
              </span>
            ) : null}
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
                      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                        {formatCurrency(b.amount)}
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                        {b.change ? <Change c={b.change} compact /> : null}
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
