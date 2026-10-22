import type { ReactNode } from "react";
import { BriefcaseBusiness, CalendarClock, Gauge, Repeat, ShieldCheck, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { repositories } from "@/infrastructure/container";
import { crToday, toISODate } from "@/domain";
import { formatCurrency, formatDate, relativeDayLabel } from "@/lib/format";
import { categoryOptions, iconsByName } from "@/lib/categories";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/schema";
import { ensurePlansUpToDate } from "@/lib/sync-plans";
import { loadPlansBoard, type PlanRow } from "@/lib/plans-board";
import { ConfirmOccurrenceRow } from "./confirm-occurrence";
import type { Account, Category, CreditCard } from "@/lib/types";
import { loadDebitCards } from "@/lib/debit-cards";
import { debitCardLabel } from "@/domain";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/delete-button";
import { EmptyRows, RowActions, RowItem, RowList } from "@/components/row-list";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { cn } from "@/lib/utils";
import { deletePlanAction } from "./actions";
import { PlanFormDialog } from "./plan-form";
import { FREQUENCY_LABEL, KIND_LABEL } from "./labels";
import { BaselineCapForm, PlanPauseButton } from "./plan-controls";

const SOURCE_LABEL: Record<string, string> = {
  subscription: "Gasto fijo",
  insurance: "Seguro",
  loan: "Préstamo",
  financing: "Financiamiento",
};

/** Planes recurrentes (2.7.0): salario, suscripciones y seguros + línea base (P4). */
export default async function PlanesPage() {
  await requireUser();
  await ensurePlansUpToDate();

  const supabase = await createClient();
  const repos = await repositories();
  const todayISO = toISODate(crToday());
  const [board, { data: accData }, { data: cardData }, { data: catData }, allDebitCards, estimated] = await Promise.all([
    loadPlansBoard(supabase, repos, todayISO),
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    supabase.from("credit_cards").select("*").order("created_at", { ascending: true }),
    supabase.from("categories").select("*").eq("archived", false).order("name", { ascending: true }),
    loadDebitCards(supabase, { includeArchived: true }),
    // P7 (3.1.0): ocurrencias con monto estimado.
    repos.plans.estimatedOccurrences(),
  ]);

  const allAccounts = (accData ?? []) as Account[];
  const allCards = (cardData ?? []) as CreditCard[];
  const accounts = allAccounts.filter((a) => !a.archived);
  const cards = allCards.filter((c) => !c.archived);
  const cats = (catData ?? []) as Category[];
  const inc = categoryOptions(cats.filter((c) => c.kind === "income"), INCOME_CATEGORIES);
  const exp = categoryOptions(cats.filter((c) => c.kind === "expense"), EXPENSE_CATEGORIES);
  const formProps = {
    accounts,
    cards,
    debitCards: allDebitCards.filter((d) => !d.archived),
    incomeCategories: { names: inc.map((o) => o.name), icons: iconsByName(inc) },
    expenseCategories: { names: exp.map((o) => o.name), icons: iconsByName(exp) },
  };
  const debitOf = (p: PlanRow) =>
    p.debit_card_id ? allDebitCards.find((d) => d.id === p.debit_card_id) : undefined;
  const targetName = (p: PlanRow) =>
    debitOf(p)
      ? debitCardLabel(debitOf(p)!)
      : p.account_id
      ? (allAccounts.find((a) => a.id === p.account_id)?.name ?? "Cuenta")
      : p.card_id
        ? (allCards.find((c) => c.id === p.card_id)?.name ?? "Tarjeta")
        : "Sin cuenta ni tarjeta";

  const { baseline: b, upcoming } = board;
  const groups: { kind: PlanRow["kind"]; title: string; icon: typeof Repeat; empty: string }[] = [
    { kind: "salary", title: "Salario", icon: BriefcaseBusiness, empty: "Agrega tu salario para ver la línea base." },
    {
      kind: "subscription",
      title: "Gastos fijos",
      icon: Repeat,
      empty: "Renta, agua, luz, internet, suscripciones… lo que pagas cada mes.",
    },
    { kind: "insurance", title: "Seguros de tarjeta", icon: ShieldCheck, empty: "Sin seguros." },
  ];
  const ratioPct = b.ratio === null ? null : Math.round(b.ratio * 1000) / 10;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BackLink href="/procesos" label="Procesos" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Planes</h1>
            <p className="text-sm text-muted-foreground">
              Salario, gastos fijos y seguros: se registran solos cuando llega su fecha.
            </p>
          </div>
          <PlanFormDialog {...formProps} />
        </div>
      </div>

      {/* P7 (3.1.0): montos por confirmar, arriba porque piden acción. */}
      {estimated.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Por confirmar</h2>
          <p className="text-sm text-muted-foreground">
            Entraron con el monto estimado. Pon el real (el saldo se ajusta solo).
          </p>
          <ul className="surface flex flex-col divide-y">
            {estimated.map((o) => (
              <ConfirmOccurrenceRow
                key={o.movement_id}
                movementId={o.movement_id}
                name={o.plan_name}
                occurredOn={o.occurred_on}
                amount={o.amount}
                currency={o.currency}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {/* P4: línea base */}
      <section className="surface rise flex flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground/80">
              <Gauge className="size-[18px]" />
            </span>
            <div>
              <h2 className="font-semibold tracking-tight">Línea base</h2>
              <p className="text-sm text-muted-foreground">
                Gastos fijos del mes contra tu salario, en colones
                {board.usdCrc ? ` (lo de dólares a $1 = ${formatCurrency(board.usdCrc)})` : ""}.
                {board.unconverted > 0
                  ? ` ${board.unconverted} monto${board.unconverted === 1 ? "" : "s"} en dólares no suma${board.unconverted === 1 ? "" : "n"}: registra el tipo de cambio.`
                  : ""}
              </p>
            </div>
          </div>
          <BaselineCapForm cap={b.capPercent} />
        </div>

        {b.ratio === null ? (
          <p className="text-sm text-muted-foreground">
            Agrega un salario para comparar tus gastos fijos ({formatCurrency(b.monthlyFixed)} al mes).
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Figure label="Salario al mes" value={formatCurrency(b.monthlyIncome)} />
              <Figure label="Gastos fijos al mes" value={formatCurrency(b.monthlyFixed)} />
              <Figure
                label={`Del salario (tope ${b.capPercent} %)`}
                value={`${ratioPct} %`}
                tone={b.overCap ? "negative" : (ratioPct ?? 0) > b.capPercent * 0.85 ? "warning" : "positive"}
              />
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <div
                data-motion
                className={cn(
                  "h-full origin-left rounded-full",
                  b.overCap ? "bg-destructive" : "bg-success",
                )}
                style={{
                  width: `${Math.min(100, (b.ratio ?? 0) * 100)}%`,
                  animation: "grow-x 450ms var(--ease-fluid) both",
                }}
              />
              <span
                className="absolute inset-y-0 w-0.5 bg-foreground/60"
                style={{ left: `${b.capPercent}%` }}
                aria-hidden
              />
            </div>
            {b.overCap ? (
              <p className="flex items-start gap-2 rounded-xl bg-destructive/8 p-3 text-sm ring-1 ring-destructive/25">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                Tus gastos fijos pasan el tope del {b.capPercent} % del salario. Revisa gastos fijos,
                préstamos o financiamientos.
              </p>
            ) : null}
          </>
        )}

        {b.items.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Gastos fijos</p>
            <ul className="flex flex-col divide-y">
              {b.items.map((it, i) => (
                <li key={`${it.source}:${it.name}:${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{SOURCE_LABEL[it.source] ?? it.source}</p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p>{formatCurrency(it.monthly)}</p>
                    {it.share !== null ? (
                      <p className="text-xs text-muted-foreground">{Math.round(it.share * 1000) / 10} % del salario</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Por periodo: {formatCurrency(b.perPeriod.week)} a la semana · {formatCurrency(b.perPeriod.fortnight)} por
              quincena · {formatCurrency(b.perPeriod.month)} al mes.
            </p>
          </div>
        ) : null}
      </section>

      {groups.map((g) => {
        const rows = board.plans.filter((p) => p.kind === g.kind);
        return (
          <section key={g.kind} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <g.icon className="size-5 text-muted-foreground" />
              {g.title}
            </h2>
            {rows.length === 0 ? (
              <EmptyRows>
                <span className="flex flex-col items-center gap-3">
                  {g.empty}
                  <PlanFormDialog {...formProps} initialKind={g.kind} />
                </span>
              </EmptyRows>
            ) : (
              <>
                <RowList
                  columns="minmax(0,1.6fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr) 7.5rem"
                  headers={[
                    { label: "Plan" },
                    { label: "Monto", align: "right" },
                    { label: g.kind === "salary" ? "Entra a" : "Se cobra a" },
                    { label: "Próxima" },
                    {},
                  ]}
                >
                  {rows.map((p, i) => (
                    <RowItem key={p.id} index={i} muted={p.archived}>
                      <PlanTitle p={p} />
                      <div className="text-right tabular-nums">
                        <span className="font-medium">{formatCurrency(p.amount, p.currency)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {FREQUENCY_LABEL[p.frequency].split(" (")[0]}
                        </span>
                      </div>
                      <span className="truncate text-muted-foreground">{targetName(p)}</span>
                      <NextLabel p={p} today={todayISO} />
                      <RowActions>
                        <PlanPauseButton id={p.id} paused={p.archived} name={p.name} />
                        <PlanFormDialog {...formProps} plan={p} />
                        <DeleteButton
                          id={p.id}
                          action={deletePlanAction}
                          confirmLabel={`¿Eliminar "${p.name}"? No habrá más ${p.kind === "salary" ? "ingresos" : "cargos"} programados; lo ya registrado se conserva.`}
                        />
                      </RowActions>
                    </RowItem>
                  ))}
                </RowList>
                <MobileList>
                  {rows.map((p, i) => (
                    <MobileCard
                      key={p.id}
                      index={i}
                      title={<PlanTitle p={p} />}
                      actions={
                        <>
                          <PlanPauseButton id={p.id} paused={p.archived} name={p.name} />
                          <PlanFormDialog {...formProps} plan={p} />
                          <DeleteButton
                            id={p.id}
                            action={deletePlanAction}
                            confirmLabel={`¿Eliminar "${p.name}"? Lo ya registrado se conserva.`}
                          />
                        </>
                      }
                    >
                      <MobileField
                        label="Monto"
                        value={`${formatCurrency(p.amount, p.currency)} · ${FREQUENCY_LABEL[p.frequency].split(" (")[0]}`}
                      />
                      <MobileField label={g.kind === "salary" ? "Entra a" : "Se cobra a"} value={targetName(p)} />
                      <MobileField label="Próxima" value={<NextLabel p={p} today={todayISO} />} />
                    </MobileCard>
                  ))}
                </MobileList>
              </>
            )}
          </section>
        );
      })}

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <CalendarClock className="size-5 text-muted-foreground" />
          Próximos 30 días
        </h2>
        {upcoming.length === 0 ? (
          <EmptyRows>Nada programado en los próximos 30 días.</EmptyRows>
        ) : (
          <ul className="surface flex flex-col divide-y overflow-hidden">
            {upcoming.map(({ plan, date }) => (
              <li key={`${plan.id}:${date}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {KIND_LABEL[plan.kind]} · {formatDate(date)} ·{" "}
                    {relativeDayLabel(Math.round((new Date(date).getTime() - new Date(todayISO).getTime()) / 86_400_000))}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-medium tabular-nums",
                    plan.kind === "salary" ? "text-success" : "text-destructive",
                  )}
                >
                  {plan.kind === "salary" ? "+" : "−"}
                  {formatCurrency(plan.amount, plan.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlanTitle({ p }: { p: PlanRow }) {
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-2">
        <span className="truncate font-medium">{p.name}</span>
        {p.archived ? <Badge variant="secondary">Pausado</Badge> : null}
      </span>
      <span className="block truncate text-xs text-muted-foreground">
        {[p.category, p.note].filter(Boolean).join(" · ") || KIND_LABEL[p.kind]}
      </span>
    </div>
  );
}

function NextLabel({ p, today }: { p: PlanRow; today: string }) {
  if (p.archived) return <span className="text-muted-foreground">Pausado</span>;
  if (!p.account_id && !p.card_id) return <span className="text-destructive">Falta cuenta o tarjeta</span>;
  if (!p.next) return <span className="text-muted-foreground">Terminó</span>;
  const days = Math.round((new Date(p.next).getTime() - new Date(today).getTime()) / 86_400_000);
  return (
    <span>
      {formatDate(p.next)}
      <span className="block text-xs text-muted-foreground">{relativeDayLabel(days)}</span>
    </span>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "positive" | "warning" | "negative";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xl font-semibold tracking-tight tabular-nums",
          tone === "positive" && "text-success",
          tone === "warning" && "text-warning",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}
