"use client";

import { useState } from "react";
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
import { CategoryBadge, CategoryIcon } from "@/components/category-icon";
import { useDialogForm } from "@/lib/use-dialog-form";
import {
  CATEGORY_ICON_KEYS,
  defaultIconFor,
  iconFor,
  type CategoryIconKey,
} from "@/lib/category-icon-keys";
import type { Category, CategoryKind } from "@/lib/types";
import { cn } from "@/lib/utils";
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
  const [name, setName] = useState(category?.name ?? "");
  // Mientras el usuario no elija uno, el ícono sigue al nombre (2.5.0).
  const [picked, setPicked] = useState<CategoryIconKey | null>(
    category ? iconFor(category) : null,
  );
  const icon = picked ?? defaultIconFor(name);

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

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar categoría" : "Nueva categoría"}
          </DialogTitle>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="kind" value={category?.kind ?? kind} />
          <input type="hidden" name="icon" value={icon} />
          {category ? (
            <input type="hidden" name="id" value={category.id} />
          ) : null}

          <FormField label="Nombre" htmlFor="name" error={errors?.name}>
            <div className="flex items-center gap-2">
              <CategoryBadge icon={icon} />
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Mascotas"
                maxLength={40}
                required
              />
            </div>
          </FormField>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Ícono</p>
            <div
              role="radiogroup"
              aria-label="Ícono de la categoría"
              className="grid max-h-56 grid-cols-7 gap-1.5 overflow-y-auto rounded-xl bg-muted/50 p-2"
            >
              {CATEGORY_ICON_KEYS.map((key) => {
                const selected = key === icon;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={key}
                    onClick={() => setPicked(key)}
                    className={cn(
                      "grid aspect-square place-items-center rounded-lg transition-[background-color,color,scale,box-shadow] duration-150 ease-fluid motion-safe:active:scale-90 [&_svg]:size-[18px]",
                      selected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-card hover:text-foreground",
                    )}
                  >
                    <CategoryIcon icon={key} />
                  </button>
                );
              })}
            </div>
            {errors?.icon ? <p className="text-xs text-destructive">{errors.icon}</p> : null}
          </div>

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
