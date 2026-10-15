"use client";

import { CategoryBadge } from "@/components/category-icon";
import { defaultIconFor, type CategoryIconKey } from "@/lib/category-icon-keys";
import { cn } from "@/lib/utils";

/**
 * Selector de categoría (2.5.0): una cuadrícula de botones grandes con ícono,
 * cómoda para el dedo. Envía el valor en un input oculto `name`.
 */
export function CategoryPicker({
  name = "category",
  categories,
  icons = {},
  value,
  onChange,
  error,
}: {
  name?: string;
  categories: string[];
  /** Nombre (minúsculas) → ícono; si falta, el sugerido por el nombre. */
  icons?: Record<string, CategoryIconKey>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name={name} value={value} />
      <div
        role="radiogroup"
        aria-label="Categoría"
        aria-invalid={Boolean(error) || undefined}
        className="grid max-h-[13.5rem] grid-cols-4 gap-1.5 overflow-y-auto overscroll-contain rounded-2xl p-0.5 sm:grid-cols-5 lg:max-h-[19rem] lg:grid-cols-4"
      >
        {categories.map((c) => {
          const selected = c === value;
          const icon = icons[c.trim().toLowerCase()] ?? defaultIconFor(c);
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(selected ? "" : c)}
              className={cn(
                "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-center text-[11px] leading-tight font-medium transition-[background-color,box-shadow,scale,color] duration-150 ease-fluid motion-safe:active:scale-95",
                selected
                  ? "bg-primary/[0.07] text-foreground ring-2 ring-primary dark:bg-primary/10"
                  : "bg-muted/50 text-muted-foreground ring-1 ring-transparent hover:bg-muted hover:text-foreground",
              )}
            >
              <CategoryBadge icon={icon} size="sm" />
              <span className="line-clamp-2 w-full break-words">{c}</span>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
