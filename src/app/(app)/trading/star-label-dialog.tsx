"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { FormField } from "@/components/form-field";
import { RELATIONSHIPS } from "@/domain";
import type { StarLabel } from "@/application";
import { shortAddress } from "@/lib/stellar/format";
import { saveStarAction } from "./actions";
import { keepOnError } from "@/lib/keep-on-error";

/** Apodo, emoji y parentesco de una dirección en MI agenda (K2: nunca en la cadena). */
export function StarLabelDialog({
  address,
  label,
  trigger,
}: {
  address: string;
  label?: StarLabel;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const r = await saveStarAction({
      id: label?.id ?? null,
      address,
      nickname: String(form.get("nickname") ?? ""),
      emoji: String(form.get("emoji") ?? "") || null,
      relationship: String(form.get("relationship") ?? "") || null,
    });
    setPending(false);
    if (!r.ok) return setError(r.message);
    toast.success("Guardado en tu constelación");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span className="contents" />}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Cómo le llamas?</DialogTitle>
          <DialogDescription>
            Solo tú ves este apodo. En la blockchain solo está la dirección {shortAddress(address)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-3">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
            <FormField label="Emoji" htmlFor="star-emoji">
              <Input id="star-emoji" name="emoji" maxLength={8} defaultValue={label?.emoji ?? ""} placeholder="🌟" className="text-center text-lg" />
            </FormField>
            <FormField label="Apodo" htmlFor="star-nickname">
              <Input id="star-nickname" name="nickname" maxLength={40} required defaultValue={label?.nickname ?? ""} placeholder="Mamá" />
            </FormField>
          </div>
          <FormField label="Parentesco (opcional)" htmlFor="star-relationship">
            <Input
              id="star-relationship"
              name="relationship"
              maxLength={30}
              list="star-relationships"
              defaultValue={label?.relationship ?? ""}
            />
            <datalist id="star-relationships">
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </FormField>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
