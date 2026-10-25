"use client";

import { useState, type ComponentType, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Banknote,
  Check,
  CreditCard,
  HandHeart,
  Inbox,
  Landmark,
  LoaderCircle,
  Pencil,
  Receipt,
} from "lucide-react";
import { MAX_FAVORITES, type Shortcut, type ShortcutKey } from "@/domain";
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
import { Badge } from "@/components/ui/badge";
import { FOCUS_OUTLINE, PRESSABLE_SURFACE } from "@/lib/interactive";
import { keepOnError } from "@/lib/keep-on-error";
import { useDialogForm } from "@/lib/use-dialog-form";
import { cn } from "@/lib/utils";
import { saveFavoritesAction } from "./actions";

/** Mismos íconos que en Procesos. */
const ICONS: Record<ShortcutKey, ComponentType<{ className?: string }>> = {
  gastos: Receipt,
  ingresos: Banknote,
  cuentas: Landmark,
  tarjetas: CreditCard,
  transferencias: ArrowLeftRight,
  cobros: HandHeart,
  pendientes: Inbox,
};

/**
 * U11 (3.2.1): cinta de accesos favoritos en el medio del Resumen. En el
 * celular caben 4 a lo ancho y el quinto se desliza; desde `sm`, todos en una
 * fila. "Editar" abre la lista para elegir hasta 5, en el orden en que se
 * marcan.
 */
export function FavoritesRibbon({
  shortcuts,
  options,
  badges = {},
}: {
  /** Los favoritos que se muestran (ya sin los de funciones apagadas). */
  shortcuts: Shortcut[];
  /** Todo lo que se puede elegir (catálogo sin funciones apagadas). */
  options: Shortcut[];
  /** Un número sobre un acceso (p. ej. avisos por enviar en Cobros). */
  badges?: Partial<Record<ShortcutKey, number>>;
}) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="favoritos">
      <div className="flex items-center justify-between gap-3">
        <h2 id="favoritos" className="text-lg font-semibold tracking-tight">
          Favoritos
        </h2>
        <EditFavorites selected={shortcuts.map((s) => s.key)} options={options} />
      </div>
      <ul
        className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-(--fav-cols) sm:gap-3 sm:overflow-visible sm:px-0"
        style={{ "--fav-cols": `repeat(${Math.max(shortcuts.length, 1)}, minmax(0, 1fr))` } as CSSProperties}
      >
        {shortcuts.map(({ key, label, href }) => {
          const Icon = ICONS[key];
          const badge = badges[key] ?? 0;
          return (
            <li key={key} className="w-[calc((100%-1.5rem)/4)] shrink-0 snap-start sm:w-auto">
              <Link
                href={href}
                className={cn(
                  "surface relative flex h-full flex-col items-center gap-2 px-1 py-3 text-center",
                  PRESSABLE_SURFACE,
                  FOCUS_OUTLINE,
                )}
              >
                <span className="grid size-10 place-items-center rounded-lg bg-muted text-foreground/80 transition-colors group-hover/link:bg-primary group-hover/link:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="font-heading w-full truncate text-sm tracking-[0.02em]">{label}</span>
                {badge > 0 ? (
                  <Badge className="absolute top-1.5 right-1.5" aria-label={`${badge} pendientes`}>
                    {badge}
                  </Badge>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EditFavorites({ selected, options }: { selected: ShortcutKey[]; options: Shortcut[] }) {
  const { open, setOpen, submit, pending, message } = useDialogForm(saveFavoritesAction, "Favoritos guardados");
  const [picked, setPicked] = useState<ShortcutKey[]>(selected);
  const full = picked.length >= MAX_FAVORITES;

  function toggle(key: ShortcutKey) {
    setPicked((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : current.length >= MAX_FAVORITES ? current : [...current, key],
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Al abrir, parte de lo que se ve en la cinta.
        if (next) setPicked(selected);
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Pencil className="size-3.5" /> Editar
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar favoritos</DialogTitle>
          <DialogDescription>
            Elige hasta {MAX_FAVORITES}. Se muestran en el orden en que los marcas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={keepOnError(submit)} className="flex flex-col gap-4">
          {picked.map((key) => (
            <input key={key} type="hidden" name="favorite" value={key} />
          ))}
          <ul className="flex flex-col gap-1.5">
            {options.map(({ key, label }) => {
              const Icon = ICONS[key];
              const position = picked.indexOf(key);
              const on = position >= 0;
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!on && full}
                    onClick={() => toggle(key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-[background-color,box-shadow] duration-150 ease-fluid disabled:opacity-45",
                      on ? "bg-card ring-2 ring-foreground/70" : "bg-muted/50 hover:bg-muted",
                      FOCUS_OUTLINE,
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{label}</span>
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs font-semibold",
                        on ? "bg-primary text-primary-foreground" : "ring-1 ring-border",
                      )}
                      aria-hidden
                    >
                      {on ? position + 1 : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {picked.length} de {MAX_FAVORITES}
            {full ? " · quita uno para elegir otro" : ""}
          </p>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || picked.length === 0}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
