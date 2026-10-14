"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

/**
 * Tema claro/oscuro (2.4.0). Sin elección guardada se sigue al sistema
 * operativo; el botón sol/luna guarda "light" o "dark" en localStorage. La
 * clase `.dark` del <html> la pone primero `THEME_SCRIPT` (`theme-script.ts`,
 * antes de pintar) y luego `setTheme`.
 */
export type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento (modo privado): el cambio vale para esta visita.
  }
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  // Mientras el usuario no elija, el tema acompaña los cambios del sistema.
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (!storedTheme()) {
      document.documentElement.classList.toggle("dark", media.matches);
    }
  };
  media.addEventListener("change", onSystem);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onSystem);
  };
}

/** Tema efectivo; en el servidor se asume claro. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}
