"use client";

import { useTransition } from "react";
import { Landmark, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchOfficialRate } from "./actions";

/** T10: trae el tipo de cambio de referencia del BCCR de hoy. */
export function OfficialRateButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await fetchOfficialRate();
          if (r?.ok) toast.success("Tipo de cambio del BCCR actualizado");
          else toast.error((r && !r.ok && r.message) || "No se pudo traer el tipo de cambio");
        })
      }
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Landmark className="size-4" />}
      Traer del BCCR
    </Button>
  );
}
