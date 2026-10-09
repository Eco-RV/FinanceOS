"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncNow } from "./actions";

export function SyncButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncNow();
          if (!r.ok) toast.error(r.message);
          else if (r.imported > 0) toast.success(`${r.imported} compra(s) nueva(s)`);
          else toast.message("Sin compras nuevas");
        })
      }
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Sincronizando…" : "Sincronizar"}
    </Button>
  );
}
