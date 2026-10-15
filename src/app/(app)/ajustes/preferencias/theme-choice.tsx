"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
];

/** Tema de la app en este dispositivo: el del sistema, claro u oscuro. */
export function ThemeChoicePicker() {
  const choice = useThemeChoice();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setThemeChoice(value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl p-3 text-sm transition-[background-color,box-shadow,scale] duration-150 ease-fluid motion-safe:active:scale-[0.97]",
              selected
                ? "bg-primary/[0.06] font-medium ring-2 ring-primary dark:bg-primary/10"
                : "bg-muted/50 text-muted-foreground ring-1 ring-transparent hover:bg-muted hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "grid h-12 w-full place-items-center rounded-lg ring-1 ring-foreground/10",
                value === "dark" ? "bg-neutral-900 text-neutral-100" : value === "light" ? "bg-white text-neutral-900" : "bg-gradient-to-r from-white from-50% to-neutral-900 to-50% text-neutral-500",
              )}
            >
              <Icon className="size-5" />
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
