"use client";

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
import { FormField } from "@/components/form-field";
import { useDialogForm } from "@/lib/use-dialog-form";
import type { DebitCard } from "@/lib/types";
import { saveDebitCard } from "./actions";
import { keepOnError } from "@/lib/keep-on-error";

/** Agregar o editar la tarjeta de débito de una cuenta (2.8.0, C3). */
export function DebitCardFormDialog({
  accountId,
  card,
}: {
  accountId: string;
  card?: DebitCard;
}) {
  const editing = Boolean(card);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveDebitCard,
    editing ? "Tarjeta actualizada" : "Tarjeta de débito agregada",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          editing ? (
            <Button variant="ghost" size="icon" aria-label="Editar tarjeta de débito" />
          ) : (
            <Button size="sm" variant="outline" />
          )
        }
      >
        {editing ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" /> Agregar tarjeta de débito
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tarjeta de débito" : "Nueva tarjeta de débito"}</DialogTitle>
          <DialogDescription>
            Los gastos con esta tarjeta salen del saldo de la cuenta. Una cuenta tiene una sola
            tarjeta de débito activa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          <input type="hidden" name="account_id" value={accountId} />
          {card ? <input type="hidden" name="id" value={card.id} /> : null}
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <FormField label="Nombre" htmlFor="debit-name" error={errors?.name}>
              <Input
                id="debit-name"
                name="name"
                maxLength={40}
                placeholder="Débito BAC"
                defaultValue={card?.name ?? ""}
                required
              />
            </FormField>
            <FormField label="Últimos 4" htmlFor="debit-last-four" error={errors?.last_four}>
              <Input
                id="debit-last-four"
                name="last_four"
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                defaultValue={card?.last_four ?? ""}
              />
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
