"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTheme, useTheme } from "@/lib/theme";

/** Botón sol/luna: alterna entre claro y oscuro y recuerda la elección. */
export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Cambiar a tema oscuro" : "Cambiar a tema claro";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
      className="rounded-full"
    >
      {/* Ambos íconos se pintan y el CSS muestra el correcto: sin parpadeo al hidratar. */}
      <Sun className="hidden size-4 dark:block motion-safe:animate-in motion-safe:spin-in-45 motion-safe:fade-in-0" />
      <Moon className="size-4 dark:hidden motion-safe:animate-in motion-safe:spin-in-45 motion-safe:fade-in-0" />
    </Button>
  );
}
