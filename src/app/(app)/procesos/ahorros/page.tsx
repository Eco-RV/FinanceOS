import type { CSSProperties } from "react";
import { PiggyBank } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crToday, goalProgress, toISODate, type GoalStatus } from "@/domain";
import type { Goal } from "@/application";
import { formatCurrency, formatDate } from "@/lib/format";
import { isCategoryIconKey } from "@/lib/category-icon-keys";
import type { Account, Transaction } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/category-icon";
import { EmptyRows } from "@/components/row-list";
import { cn } from "@/lib/utils";
import { GoalFormDialog } from "./goal-form";
import { ContributionForm } from "./contribution-form";
import { GoalControls } from "./goal-controls";

const STATUS: Record<GoalStatus, { label: string; className: string }> = {
  lograda: { label: "¡Lograda!", className: "bg-success/15 text-success" },
  "en-camino": { label: "En camino", className: "bg-muted text-foreground" },
  atrasada: { label: "Se pasó la fecha", className: "bg-destructive/12 text-destructive" },
  "sin-fecha": { label: "Sin fecha", className: "bg-muted text-muted-foreground" },
};

/** Ahorros y metas (2.7.0). */
export default async function AhorrosPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data: goalData, error }, { data: accData }] = await Promise.all([
    supabase
      .from("savings_goals")
      .select("id, name, target_amount, currency, target_date, account_id, icon, archived")
      .order("created_at", { ascending: true }),
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
  ]);
  const missingSql = Boolean(error);
  const goals = ((goalData ?? []) as Goal[]).map((g) => ({ ...g, target_amount: Number(g.target_amount) }));
  const allAccounts = (accData ?? []) as Account[];
  const accounts = allAccounts.filter((a) => !a.archived);
  const todayISO = toISODate(crToday());

  // Aportes = transferencias recientes hacia las cuentas de las metas.
  const goalAccountIds = goals.map((g) => g.account_id).filter((id): id is string => Boolean(id));
  const { data: txData } = goalAccountIds.length
    ? await supabase
        .from("transactions")
        .select("id, type, amount, currency, occurred_on, to_account_id, account_id, note")
        .eq("archived", false)
        .eq("type", "transfer")
        .in("to_account_id", goalAccountIds)
        .order("occurred_on", { ascending: false })
        .limit(60)
    : { data: [] };
  const contributions = (txData ?? []) as Transaction[];

  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);
  const taken = active.map((g) => g.account_id).filter((id): id is string => Boolean(id));

  const rows = active.map((g) => {
    const account = allAccounts.find((a) => a.id === g.account_id) ?? null;
    const saved = account ? Number(account.current_balance) : 0;
    const progress = goalProgress({ targetAmount: g.target_amount, saved, targetDate: g.target_date, today: todayISO });
    return { g, account, progress };
  });
  const totalSavedCrc = rows
    .filter((r) => r.g.currency === "CRC")
    .reduce((s, r) => s + r.progress.saved, 0);
  const totalTargetCrc = rows.filter((r) => r.g.currency === "CRC").reduce((s, r) => s + r.g.target_amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/procesos" label="Procesos" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ahorros y metas</h1>
            <p className="text-sm text-muted-foreground">
              Cada meta vive en una cuenta: lo ahorrado es su saldo y aportar es transferirle.
            </p>
          </div>
          {!missingSql ? <GoalFormDialog accounts={accounts} takenAccountIds={taken} /> : null}
        </div>
      </div>

      {missingSql ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Falta correr el SQL de la versión 2.7.0 (<code>supabase/Versionamiento/2.7.0/</code>).
        </p>
      ) : rows.length === 0 ? (
        <EmptyRows>
          <span className="flex flex-col items-center gap-3">
            <PiggyBank className="size-8 text-muted-foreground" />
            Aún no tienes metas. Crea la primera y ligala a tu cuenta de ahorro.
          </span>
        </EmptyRows>
      ) : (
        <>
          {totalTargetCrc > 0 ? (
            <div className="surface rise flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
              <div>
                <p className="text-sm text-muted-foreground">Ahorrado en tus metas (colones)</p>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatCurrency(totalSavedCrc)}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                de {formatCurrency(totalTargetCrc)} ·{" "}
                {Math.round((Math.min(totalSavedCrc, totalTargetCrc) / totalTargetCrc) * 100)} %
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ g, account, progress }, i) => {
              const status = STATUS[progress.status];
              const recent = contributions.filter((c) => c.to_account_id === g.account_id).slice(0, 3);
              const sources = accounts.filter((a) => a.currency === g.currency && a.id !== g.account_id);
              return (
                <article
                  key={g.id}
                  className="surface rise flex flex-col gap-4 p-4 sm:p-5"
                  style={{ "--rise-i": Math.min(i + 1, 12) } as CSSProperties}
                >
                  <div className="flex items-start gap-3">
                    <CategoryBadge icon={g.icon && isCategoryIconKey(g.icon) ? g.icon : "piggy-bank"} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold tracking-tight">{g.name}</h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {account ? account.name : "Sin cuenta ligada"}
                        {g.target_date ? ` · para el ${formatDate(g.target_date)}` : ""}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", status.className)}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-semibold tracking-tight tabular-nums">
                        {formatCurrency(progress.saved, g.currency)}
                      </span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        de {formatCurrency(g.target_amount, g.currency)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        data-motion
                        className={cn(
                          "h-full origin-left rounded-full",
                          progress.status === "lograda"
                            ? "bg-success"
                            : progress.status === "atrasada"
                              ? "bg-destructive"
                              : "bg-chart-2",
                        )}
                        style={{
                          width: `${Math.max(2, progress.ratio * 100)}%`,
                          animation: "grow-x 800ms var(--ease-fluid) both",
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(progress.ratio * 100)} %
                      {progress.remaining > 0 ? ` · faltan ${formatCurrency(progress.remaining, g.currency)}` : ""}
                      {progress.monthlyNeeded && progress.status === "en-camino"
                        ? ` · ${formatCurrency(progress.monthlyNeeded, g.currency)} al mes`
                        : ""}
                    </p>
                  </div>

                  {recent.length > 0 ? (
                    <ul className="flex flex-col gap-1 border-t pt-3 text-xs">
                      {recent.map((c) => (
                        <li key={c.id} className="flex justify-between gap-2 text-muted-foreground">
                          <span>
                            {formatDate(c.occurred_on)} ·{" "}
                            {allAccounts.find((a) => a.id === c.account_id)?.name ?? "Cuenta"}
                          </span>
                          <span className="tabular-nums text-success">+{formatCurrency(Number(c.amount), c.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between gap-2">
                    {account && !account.archived ? (
                      <ContributionForm
                        goalName={g.name}
                        account={account}
                        sources={sources}
                        suggested={progress.status === "en-camino" ? progress.monthlyNeeded : null}
                      />
                    ) : (
                      <Badge variant="secondary">Liga una cuenta para aportar</Badge>
                    )}
                    <div className="flex gap-1">
                      <GoalFormDialog goal={g} accounts={accounts} takenAccountIds={taken} />
                      <GoalControls id={g.id} name={g.name} archived={false} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {archived.length > 0 ? (
        <details className="surface p-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
            Archivadas ({archived.length})
          </summary>
          <ul className="mt-2 flex flex-col divide-y">
            {archived.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-muted-foreground">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Objetivo {formatCurrency(g.target_amount, g.currency)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <GoalControls id={g.id} name={g.name} archived />
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
