import type { StoredLoanAdjustment } from "@/application";

/** Fila de `loan_adjustments` → ajuste del dominio (L7/L8). */
export function toLoanAdjustment(r: Record<string, unknown>): StoredLoanAdjustment {
  const event =
    r.kind === "rate"
      ? { kind: "rate" as const, fromNo: Number(r.from_installment), annualRatePercent: Number(r.annual_rate) }
      : {
          kind: "prepayment" as const,
          afterNo: Number(r.after_installment),
          amount: Number(r.amount),
          mode: r.mode === "payment" ? ("payment" as const) : ("term" as const),
        };
  return {
    id: r.id as string,
    event,
    occurred_on: r.occurred_on as string,
    transaction_id: (r.transaction_id as string | null) ?? null,
  };
}
