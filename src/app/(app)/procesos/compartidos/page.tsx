import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crToday, toISODate } from "@/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { FOCUS_OUTLINE, PRESSABLE_SURFACE } from "@/lib/interactive";
import { loadSharedBoard } from "@/lib/shared-board";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

/**
 * Gastos compartidos (3.0.1): lo que pagaste completo y divides con otras
 * personas. Arriba, cuánto te debe cada una; abajo, cada gasto con su avance.
 */
export default async function CompartidosPage() {
  await requireUser();
  const todayISO = toISODate(crToday());
  const board = await loadSharedBoard(await createClient(), todayISO);
  const expenses = [...board.expenses.values()];
  const pendingNotices = board.groups.filter((g) => g.needsNotice).length;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gastos compartidos</h1>
          <p className="text-sm text-muted-foreground">
            Pagas el total, divides entre varias personas y llevas el control de quién ya te pagó.
          </p>
        </div>
        <Link href="/procesos/compartidos/nuevo" className={buttonVariants({ size: "sm" })}>
          <Plus className="size-4" /> Nuevo gasto compartido
        </Link>
      </div>

      {expenses.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 p-8 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Todavía no compartes ningún gasto. Registra uno nuevo o, desde Gastos, toca{" "}
            <span className="font-medium text-foreground">Compartir</span> en un gasto que ya
            registraste.
          </p>
        </div>
      ) : null}

      {board.receivables.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Por cobrar</h2>
            {pendingNotices > 0 ? (
              <Link href="/procesos/cobros" className="text-sm text-muted-foreground hover:text-foreground">
                {pendingNotices} aviso{pendingNotices === 1 ? "" : "s"} por enviar →
              </Link>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {board.receivables.map((r) => (
              <div key={`${r.member_id}:${r.currency}`} className="surface flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{board.members.get(r.member_id)?.name ?? "Persona"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.parts.length} gasto{r.parts.length === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">{formatCurrency(r.total, r.currency)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {expenses.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Gastos</h2>
          <ul className="flex flex-col gap-2">
            {expenses.map((e, i) => {
              const paid = e.parts.filter((p) => p.paid_on);
              const collected = paid.reduce((s, p) => s + p.amount, 0);
              const owed = e.parts.reduce((s, p) => s + p.amount, 0);
              const done = paid.length === e.parts.length;
              const late = !done && e.due_on < todayISO;
              return (
                <li key={e.id} className="rise" style={{ "--rise-i": i } as React.CSSProperties}>
                  <Link
                    href={`/procesos/compartidos/${e.id}`}
                    className={cn("surface flex items-center gap-3 p-3 sm:p-4", PRESSABLE_SURFACE, FOCUS_OUTLINE)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="truncate">{e.description}</span>
                        {done ? (
                          <Badge variant="secondary">Cobrado</Badge>
                        ) : late ? (
                          <Badge variant="destructive">Vencido</Badge>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(e.occurred_on)} · {e.parts.length} persona{e.parts.length === 1 ? "" : "s"} ·
                        antes del {formatDate(e.due_on)}
                      </p>
                      {/* Avance de lo cobrado. */}
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-success transition-[width] duration-500"
                          style={{ width: `${owed > 0 ? Math.round((collected / owed) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums">{formatCurrency(e.total_amount, e.currency)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        cobrado {formatCurrency(collected, e.currency)} de {formatCurrency(owed, e.currency)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
