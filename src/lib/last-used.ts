"use client";

/**
 * Lo último que el usuario eligió en un formulario (3.1.0, ley de Parkinson:
 * llenar lo que ya se sabe). Vive solo en este navegador; si no hay
 * almacenamiento (modo privado), simplemente no se recuerda nada.
 */
const PREFIX = "ultimo:";

export function readLastUsed(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function rememberLastUsed(key: string, value: string | null | undefined): void {
  if (!value) return;
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}
