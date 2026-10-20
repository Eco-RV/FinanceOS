import Link from "next/link";
import { Gauge, PiggyBank } from "lucide-react";
import { goalProgress, goalsSaved, type ISODate } from "@/domain";
import type { Goal } from "@/application";
import type { PlansBoard } from "@/lib/plans-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { isCategoryIconKey } from "@/lib/category-icon-keys";
import { CategoryBadge } from "@/components/category-icon";
import { LinkChevron } from "@/components/link-pending";
import { FOCUS_OUTLINE, PRESSABLE_SURFACE } from "@/lib/interactive";
import { cn } from "@/lib/utils";

const CARD = cn("surface rise flex flex-col gap-3 p-4 sm:p-5", PRESSABLE_SURFACE, FOCUS_OUTLINE);

/** Resumen (2.7.0): línea base (P4) + lo próximo programado, y avance de metas. */
export function PlansAndGoals({
  board,
  goals,
  balances,
  todayISO,
}: {
  board: PlansBoard;
  goals: Goal[];
  /** Saldo de cada cuenta (para lo ahorrado de cada meta). */
  balances: Record<string, number>;
  todayISO: ISODate;
}) {
  const b = board.baseline;
  const next = board.upcoming.slice(0, 3);
  const active = goals.filter((g) => !g.archived);
  if (board.plans.length === 0 && active.length === 0) return null;
  const pct = b.ratio === null ? null : Math.round(b.ratio * 1000) / 10;

  return (
    <div className="grid gap-3 sm:gap-4 lg:col-span-3 lg:grid-cols-2">
      <Link href="/procesos/planes" className={CARD} style={{ ["--rise-i" as string]: 14 }}>
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Gauge className="size-4" />
          Línea base
          <LinkChevron className="ml-auto" />
        </div>
        {pct === null ? (
          <p className="text-sm text-muted-foreground">
            Agrega tu salario en Planes para comparar tus gastos fijos ({formatCurrency(b.monthlyFixed)} al mes).
          </p>
        ) : (
          <>
            <p className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-2xl font-semibold tracking-tight tabular-nums",
                  b.overCap ? "text-destructive" : pct > b.capPercent * 0.85 ? "text-warning" : "text-success",
                )}
              >
                {pct} %
              </span>
              <span className="text-sm text-muted-foreground">
                del salario en gastos fijos · tope {b.capPercent} %
              </span>
            </p>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", b.overCap ? "bg-destructive" : "bg-success")}
                style={{ width: `${Math.min(100, (b.ratio ?? 0) * 100)}%` }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${b.capPercent}%` }} />
            </div>
          </>
        )}
        {next.length > 0 ? (
          <ul className="flex flex-col gap-1 border-t pt-3 text-sm">
            {next.map(({ plan, date }) => (
              <li key={`${plan.id}:${date}`} className="flex justify-between gap-3">
                <span className="truncate text-muted-foreground">
                  {formatDate(date)} · {plan.name}
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    plan.kind === "salary" ? "text-success" : "text-foreground",
                  )}
                >
                  {plan.kind === "salary" ? "+" : "−"}
                  {formatCurrency(plan.amount, plan.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Link>

      <Link href="/procesos/ahorros" className={CARD} style={{ ["--rise-i" as string]: 15 }}>
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <PiggyBank className="size-4" />
          Metas de ahorro
          <LinkChevron className="ml-auto" />
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Crea una meta y liga tu cuenta de ahorro.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.slice(0, 3).map((g) => {
              const p = goalProgress({
                targetAmount: Number(g.target_amount),
                // A4: con varias metas en la cuenta, lo apartado.
                saved: g.account_id
                  ? (goalsSaved(
                      balances[g.account_id] ?? 0,
                      active
                        .filter((x) => x.account_id === g.account_id)
                        .map((x) => ({ id: x.id, allocated: Number(x.allocated ?? 0) })),
                    ).saved.get(g.id) ?? 0)
                  : 0,
                targetDate: g.target_date,
                today: todayISO,
              });
              return (
                <li key={g.id} className="flex items-center gap-3">
                  <CategoryBadge icon={g.icon && isCategoryIconKey(g.icon) ? g.icon : "piggy-bank"} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {Math.round(p.ratio * 100)} % · {formatCurrency(p.saved, g.currency)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          p.status === "lograda" ? "bg-success" : p.status === "atrasada" ? "bg-destructive" : "bg-chart-2",
                        )}
                        style={{ width: `${Math.max(2, p.ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Link>
    </div>
  );
}
