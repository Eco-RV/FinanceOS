import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { crToday, toISODate } from "@/domain";
import type { OpeningBalance } from "@/lib/types";

/**
 * Campos de "Saldo inicial" (C1) para cuentas y tarjetas. Se guardan como un
 * movimiento `opening_balance`; el saldo actual lo calculan los movimientos.
 */
export function OpeningBalanceFields({
  opening,
  errors,
  hint,
}: {
  opening?: OpeningBalance;
  errors?: Record<string, string>;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Saldo inicial" htmlFor="opening_amount" error={errors?.opening_amount}>
          <Input
            id="opening_amount"
            name="opening_amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            defaultValue={opening?.amount ?? 0}
          />
        </FormField>
        <FormField label="Fecha del saldo" htmlFor="opening_date" error={errors?.opening_date}>
          <Input
            id="opening_date"
            name="opening_date"
            type="date"
            defaultValue={opening?.occurred_on ?? toISODate(crToday())}
            required
          />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
