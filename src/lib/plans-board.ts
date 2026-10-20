import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  toColones,
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
  /** P4: línea base en colones (lo de dólares convertido desde 3.1.0). */
  baseline: Baseline;
  /** Planes, cuotas o salarios en dólares que no suman por falta de tipo de cambio. */
  unconverted: number;
  /** Tipo de cambio usado, o `null`. */
  usdCrc: number | null;
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
  const [all, profile, { data: loanData }, { data: loanPayData }, { data: finData }, { data: cuotaData }, rate] =
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
      // P4 (3.1.0): lo de dólares entra a la línea base convertido.
      repos.exchangeRates.latest().catch(() => null),
    ]);
  const usdCrc = rate?.usd_crc ?? null;
  let unconverted = 0;
  /** Monto mensual en colones, o `null` (y se cuenta) si es en dólares sin tipo de cambio. */
  const crc = (amount: number, currency: string): number | null => {
    const v = toColones(amount, currency === "USD" ? "USD" : "CRC", usdCrc);
    if (v === null) unconverted++;
    return v;
  };

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

  // Gastos fijos, en colones (los de dólares convertidos, 3.1.0).
  const fixed: FixedCost[] = active
    .filter((p) => p.kind !== "salary")
    .flatMap((p) => {
      const monthly = crc(p.monthly, p.currency);
      return monthly === null ? [] : [{ name: p.currency === "USD" ? `${p.name} (US$)` : p.name, source: p.kind, monthly }];
    });

  const paid = new Map<string, number[]>();
  for (const r of (loanPayData ?? []) as { loan_id: string; installment_no: number }[]) {
    paid.set(r.loan_id, [...(paid.get(r.loan_id) ?? []), Number(r.installment_no)]);
  }
  const loanAdjustments = await loadLoanAdjustments(supabase);
  for (const loan of (loanData ?? []) as Loan[]) {
    const currency = loan.currency === "USD" ? "USD" : "CRC";
    const progress = loanProgress(
      termsOf({ ...loan, currency }, loanAdjustments.get(loan.id) ?? []),
      paid.get(loan.id) ?? [],
      todayISO,
    );
    // Con abonos o tasa variable, la cuota que sigue (L7/L8).
    const monthly = progress.next ? crc(progress.next.payment, currency) : null;
    if (monthly !== null) fixed.push({ name: currency === "USD" ? `${loan.name} (US$)` : loan.name, source: "loan", monthly });
  }

  const cuotas = (cuotaData ?? []) as Pick<
    Transaction,
    "financing_id" | "installment_no" | "occurred_on" | "amount" | "interest_amount"
  >[];
  for (const f of (finData ?? []) as Financing[]) {
    const rows = cuotas
      .filter((t) => t.financing_id === f.id)
      .map((t) => ({ ...t, amount: Number(t.amount), installment_no: Number(t.installment_no) }));
    const p = financingProgress(storedInstallments(rows, f.months, Number(f.total_amount)), todayISO);
    const monthly = p.next ? crc(p.next.amount, f.currency) : null;
    if (monthly !== null) {
      fixed.push({ name: f.currency === "USD" ? `${f.description} (US$)` : f.description, source: "financing", monthly });
    }
  }

  const salaries = active
    .filter((p) => p.kind === "salary")
    .flatMap((p) => {
      const amount = crc(p.amount, p.currency);
      return amount === null ? [] : [{ amount, frequency: p.frequency }];
    });
  const cap = Number(profile?.preferences?.baselineCapPercent ?? DEFAULT_BASELINE_CAP);

  return {
    plans,
    upcoming,
    baseline: baseline(salaries, fixed, Number.isFinite(cap) ? cap : DEFAULT_BASELINE_CAP),
    unconverted,
    usdCrc,
  };
}
