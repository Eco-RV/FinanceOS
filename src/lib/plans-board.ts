import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  baseline,
  DEFAULT_BASELINE_CAP,
  financingProgress,
  loanProgress,
  monthlyEquivalent,
  storedInstallments,
  upcomingOccurrences,
  type Baseline,
  type FixedCost,
  type ISODate,
} from "@/domain";
import { termsOf, type Plan } from "@/application";
import { loadLoanAdjustments } from "@/lib/loan-adjustments";
import type { Repositories } from "@/infrastructure/supabase/repositories";
import type { Financing, Loan, Transaction } from "@/lib/types";

export type PlanRow = Plan & {
  /** Próxima ocurrencia programada (> hoy), o null si terminó. */
  next: ISODate | null;
  monthly: number;
};

export type UpcomingItem = {
  plan: Plan;
  date: ISODate;
};

export type PlansBoard = {
  plans: PlanRow[];
  /** Ocurrencias programadas de los planes activos, de la más próxima a la más lejana. */
  upcoming: UpcomingItem[];
  /** P4: línea base en colones. */
  baseline: Baseline;
};

function addDays(iso: ISODate, days: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Read model de Planes (2.7.0) para la pantalla de Planes y el Resumen: cada
 * plan con su próxima fecha, lo programado de los próximos días y la línea
 * base (salarios vs. gastos fijos: suscripciones, seguros, cuotas de
 * préstamos y de financiamientos), todo en colones.
 */
export async function loadPlansBoard(
  supabase: SupabaseClient,
  repos: Repositories,
  todayISO: ISODate,
  options: { upcomingDays?: number } = {},
): Promise<PlansBoard> {
  const until = addDays(todayISO, options.upcomingDays ?? 30);
  const [all, profile, { data: loanData }, { data: loanPayData }, { data: finData }, { data: cuotaData }] =
    await Promise.all([
      repos.plans.list(),
      repos.profiles.get().catch(() => null),
      supabase.from("loans").select("*").eq("archived", false),
      supabase
        .from("transactions")
        .select("loan_id, installment_no")
        .not("loan_id", "is", null)
        .not("installment_no", "is", null)
        .eq("archived", false),
      supabase.from("financings").select("*").eq("archived", false).is("cancelled_on", null),
      supabase
        .from("transactions")
        .select("financing_id, installment_no, occurred_on, amount, interest_amount")
        .eq("archived", false)
        .not("financing_id", "is", null)
        .not("installment_no", "is", null),
    ]);

  const plans: PlanRow[] = all.map((p) => {
    const next = upcomingOccurrences(
      { frequency: p.frequency, startsOn: p.starts_on, endsOn: p.ends_on },
      todayISO,
      addDays(todayISO, 400),
    )[0] ?? null;
    return { ...p, next, monthly: monthlyEquivalent(p.amount, p.frequency) };
  });

  const active = plans.filter((p) => !p.archived && (p.account_id || p.card_id));
  const upcoming = active
    .flatMap((p) =>
      upcomingOccurrences({ frequency: p.frequency, startsOn: p.starts_on, endsOn: p.ends_on }, todayISO, until).map(
        (date) => ({ plan: p as Plan, date }),
      ),
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  // Gastos fijos en colones.
  const fixed: FixedCost[] = active
    .filter((p) => p.kind !== "salary" && p.currency === "CRC")
    .map((p) => ({ name: p.name, source: p.kind, monthly: p.monthly }));

  const paid = new Map<string, number[]>();
  for (const r of (loanPayData ?? []) as { loan_id: string; installment_no: number }[]) {
    paid.set(r.loan_id, [...(paid.get(r.loan_id) ?? []), Number(r.installment_no)]);
  }
  const loanAdjustments = await loadLoanAdjustments(supabase);
  for (const loan of (loanData ?? []) as Loan[]) {
    if (loan.currency !== "CRC") continue;
    const progress = loanProgress(
      termsOf({ ...loan, currency: "CRC" }, loanAdjustments.get(loan.id) ?? []),
      paid.get(loan.id) ?? [],
      todayISO,
    );
    // Con abonos o tasa variable, la cuota que sigue (L7/L8).
    if (progress.next) fixed.push({ name: loan.name, source: "loan", monthly: progress.next.payment });
  }

  const cuotas = (cuotaData ?? []) as Pick<
    Transaction,
    "financing_id" | "installment_no" | "occurred_on" | "amount" | "interest_amount"
  >[];
  for (const f of (finData ?? []) as Financing[]) {
    if (f.currency === "USD") continue;
    const rows = cuotas
      .filter((t) => t.financing_id === f.id)
      .map((t) => ({ ...t, amount: Number(t.amount), installment_no: Number(t.installment_no) }));
    const p = financingProgress(storedInstallments(rows, f.months, Number(f.total_amount)), todayISO);
    if (p.next) fixed.push({ name: f.description, source: "financing", monthly: p.next.amount });
  }

  const salaries = active
    .filter((p) => p.kind === "salary" && p.currency === "CRC")
    .map((p) => ({ amount: p.amount, frequency: p.frequency }));
  const cap = Number(profile?.preferences?.baselineCapPercent ?? DEFAULT_BASELINE_CAP);

  return {
    plans,
    upcoming,
    baseline: baseline(salaries, fixed, Number.isFinite(cap) ? cap : DEFAULT_BASELINE_CAP),
  };
}
