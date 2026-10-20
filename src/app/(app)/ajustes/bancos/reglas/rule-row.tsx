"use client";

import { useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/form-field";
import { confirmAction } from "@/lib/confirm";
import { changeRuleAction, deleteRuleAction } from "./actions";

/** I6: una regla comercio → categoría, editable en el lugar. */
export function RuleRow({ id, merchant, category, categories }: { id: string; merchant: string; category: string; categories: string[] }) {
  const [pending, start] = useTransition();
  const run = (action: (fd: FormData) => Promise<{ ok: boolean; message?: string } | undefined>, fields: Record<string, string>, ok: string) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    start(async () => {
      const r = await action(fd);
      if (r?.ok) toast.success(ok);
      else toast.error(r?.message ?? "No se pudo completar");
    });
  };
  const options = categories.includes(category) ? categories : [category, ...categories];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <span className="min-w-0 truncate font-medium">{merchant}</span>
      <span className="flex items-center gap-2">
        <Select
          aria-label={`Categoría de ${merchant}`}
          value={category}
          onChange={(e) => run(changeRuleAction, { id, category: e.target.value }, "Regla actualizada")}
          className="w-44"
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Borrar la regla de ${merchant}`}
          disabled={pending}
          onClick={async () => {
            const ok = await confirmAction({
              title: `¿Borrar la regla de ${merchant}?`,
              description: "La próxima compra de este comercio llegará sin categoría sugerida y se volverá a aprender al aprobarla.",
              confirmLabel: "Borrar",
              tone: "danger",
              icon: "delete",
            });
            if (ok) run(deleteRuleAction, { id }, "Regla borrada");
          }}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </span>
    </li>
  );
}
