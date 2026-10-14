"use client";

import { Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Select } from "@/components/form-field";
import { useDialogForm } from "@/lib/use-dialog-form";
import type { Bank } from "@/lib/types";
import { PARSERS } from "@/lib/mail/parsers/index.ts";
import { saveBank } from "./actions";

export function BankFormDialog({ bank }: { bank?: Bank }) {
  const editing = Boolean(bank);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveBank,
    editing ? "Banco actualizado" : "Banco agregado",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          editing ? (
            <Button variant="ghost" size="icon" aria-label="Editar" />
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
          <DialogTitle>{editing ? "Editar banco" : "Nuevo banco"}</DialogTitle>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          {bank ? <input type="hidden" name="id" value={bank.id} /> : null}

          <FormField label="Nombre" htmlFor="name" error={errors?.name}>
            <Input
              id="name"
              name="name"
              defaultValue={bank?.name}
              placeholder="Ej. BAC"
              maxLength={60}
              required
            />
          </FormField>

          <FormField
            label="Remitentes de las notificaciones"
            htmlFor="sender_emails"
            error={errors?.sender_emails}
          >
            <Input
              id="sender_emails"
              name="sender_emails"
              defaultValue={bank?.sender_emails.join(", ")}
              placeholder="notificacionbac@baccredomatic.cr"
              required
            />
          </FormField>

          <FormField
            label="Formato del correo"
            htmlFor="parser_key"
            error={errors?.parser_key}
          >
            <Select
              id="parser_key"
              name="parser_key"
              defaultValue={bank?.parser_key ?? "bac"}
            >
              {Object.entries(PARSERS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={bank?.enabled ?? true}
            />
            Leer los correos de este banco
          </label>

          {message ? (
            <p className="text-sm text-destructive">{message}</p>
          ) : null}

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
