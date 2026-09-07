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
import { FormField } from "@/components/form-field";
import { useDialogForm } from "@/lib/use-dialog-form";
import type { Category, CategoryKind } from "@/lib/types";
import { saveCategory } from "./actions";

export function CategoryFormDialog({
  kind,
  category,
}: {
  kind: CategoryKind;
  category?: Category;
}) {
  const editing = Boolean(category);
  const { open, setOpen, submit, pending, errors, message } = useDialogForm(
    saveCategory,
    editing ? "Categoría actualizada" : "Categoría agregada",
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
          <DialogTitle>
            {editing ? "Editar categoría" : "Nueva categoría"}
          </DialogTitle>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="kind" value={category?.kind ?? kind} />
          {category ? (
            <input type="hidden" name="id" value={category.id} />
          ) : null}

          <FormField label="Nombre" htmlFor="name" error={errors?.name}>
            <Input
              id="name"
              name="name"
              defaultValue={category?.name}
              placeholder="Ej. Mascotas"
              maxLength={40}
              required
            />
          </FormField>

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
