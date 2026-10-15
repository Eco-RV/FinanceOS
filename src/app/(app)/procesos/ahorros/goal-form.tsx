"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Select } from "@/components/form-field";
import { CategoryIcon } from "@/components/category-icon";
import { useDialogForm } from "@/lib/use-dialog-form";
import { CATEGORY_ICON_KEYS, isCategoryIconKey, type CategoryIconKey } from "@/lib/category-icon-keys";
import { CURRENCIES } from "@/lib/schema";
import type { Goal } from "@/application";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveGoalAction } from "./actions";

/** Íconos sugeridos primero para metas. */
const GOAL_ICONS: CategoryIconKey[] = [
  "piggy-bank",
  "plane",
  "home",
  "car",
  "graduation-cap",
  "gift",
  "shield",
  "laptop",
  "heart-pulse",
  "baby",
  "paw-print",
  "sparkles",
  ...CATEGORY_ICON_KEYS.filter(
    (k) =>
      ![
        "piggy-bank",
        "plane",
        "home",
        "car",
        "graduation-cap",
        "gift",
        "shield",
        "laptop",
        "heart-pulse",
        "baby",
        "paw-print",
        "sparkles",
      ].includes(k),
  ),
];

export function GoalFormDialog({
  goal,
  accounts,
  takenAccountIds,
}: {
  goal?: Goal;
  /** Cuentas activas; se sugieren primero las de ahorro. */
  accounts: Account[];
  /** Cuentas que ya tienen otra meta activa (S1). */
  takenAccountIds: string[];
}) {
  const editing = Boolean(goal);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveGoalAction,
    editing ? "Meta actualizada" : "Meta creada",
    { celebrate: !editing },
  );
  const [currency, setCurrency] = useState(goal?.currency ?? "CRC");
  const [icon, setIcon] = useState<CategoryIconKey>(
    goal?.icon && isCategoryIconKey(goal.icon) ? goal.icon : "piggy-bank",
  );
  const options = accounts
    .filter((a) => a.currency === currency && (!takenAccountIds.includes(a.id) || a.id === goal?.account_id))
    .sort((a, b) => Number(b.type === "savings") - Number(a.type === "savings"));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={editing ? <Button variant="ghost" size="icon" aria-label="Editar" /> : <Button size="sm" />}
      >
        {editing ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" /> Nueva meta
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar meta" : "Nueva meta de ahorro"}</DialogTitle>
          <DialogDescription>
            Liga la meta a una cuenta: lo ahorrado es su saldo y los aportes son transferencias hacia ella.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex min-w-0 flex-col gap-4">
          {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
          <input type="hidden" name="icon" value={icon} />

          <FormField label="Nombre" htmlFor="goal-name" error={errors?.name}>
            <Input
              id="goal-name"
              name="name"
              defaultValue={goal?.name ?? ""}
              maxLength={60}
              placeholder="Ej. Viaje a Japón"
              required
            />
          </FormField>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Ícono</p>
            <div
              role="radiogroup"
              aria-label="Ícono de la meta"
              className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-xl bg-muted/50 p-2"
            >
              {GOAL_ICONS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={k === icon}
                  aria-label={k}
                  onClick={() => setIcon(k)}
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg transition-[background-color,color,scale] duration-150 motion-safe:active:scale-90 [&_svg]:size-[18px]",
                    k === icon
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  <CategoryIcon icon={k} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <FormField label="Objetivo" htmlFor="goal-target" error={errors?.target_amount}>
              <Input
                id="goal-target"
                name="target_amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={goal?.target_amount ?? ""}
                required
              />
            </FormField>
            <FormField label="Moneda" htmlFor="goal-currency">
              <Select
                id="goal-currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Goal["currency"])}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha (opcional)" htmlFor="goal-date" error={errors?.target_date}>
              <Input id="goal-date" name="target_date" type="date" defaultValue={goal?.target_date ?? ""} />
            </FormField>
            <FormField label="Cuenta" htmlFor="goal-account" error={errors?.account_id}>
              <Select key={currency} id="goal-account" name="account_id" defaultValue={goal?.account_id ?? ""}>
                <option value="">Sin cuenta</option>
                {options.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.type === "savings" ? " (ahorro)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
