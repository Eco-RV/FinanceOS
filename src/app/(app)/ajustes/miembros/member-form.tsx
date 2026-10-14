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
import type { Member } from "@/lib/types";
import { saveMember } from "./actions";

export function MemberFormDialog({ member }: { member?: Member }) {
  const editing = Boolean(member);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveMember,
    editing ? "Miembro actualizado" : "Miembro agregado",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          editing ? (
            <Button variant="ghost" size="icon" aria-label="Editar" title="Editar" />
          ) : (
            <Button size="sm" />
          )
        }
      >
        {editing ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" /> Agregar
          </>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar miembro" : "Nuevo miembro"}</DialogTitle>
          <DialogDescription>
            Alguien que te paga parte de las cuotas de un financiamiento. El
            correo y el WhatsApp se usan para avisarle cuánto le toca.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          {member ? <input type="hidden" name="id" value={member.id} /> : null}

          <FormField label="Nombre" htmlFor="name" error={errors?.name}>
            <Input
              id="name"
              name="name"
              defaultValue={member?.name}
              placeholder="Ej. Mamá"
              maxLength={60}
              required
            />
          </FormField>
          <FormField label="Correo" htmlFor="email" error={errors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={member?.email ?? ""}
              placeholder="nombre@correo.com"
            />
          </FormField>
          <FormField
            label="WhatsApp"
            htmlFor="phone"
            error={errors?.phone}
            hint="8 dígitos (Costa Rica) o con código de país."
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={member?.phone ?? ""}
              placeholder="8888 7777"
            />
          </FormField>

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
