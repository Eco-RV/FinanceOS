"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recomputeAction } from "./actions";

export function RecomputeButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await recomputeAction();
          if (!r.ok) toast.error(r.message);
          else toast.success(`Saldos recalculados (${r.changed} corregido(s))`);
        })
      }
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Recalculando…" : "Recalcular desde movimientos"}
    </Button>
  );
}
