import { DomainError } from "../shared/errors.ts";

/**
 * U11 (3.2.1): accesos favoritos de la cinta del Resumen. Cada usuario elige
 * hasta `MAX_FAVORITES` de este catálogo; se guardan en el perfil
 * (`preferences.favorites`) como lista de claves, en el orden elegido.
 */
export const SHORTCUTS = [
  { key: "gastos", label: "Gastos", href: "/procesos/gastos" },
  { key: "ingresos", label: "Ingresos", href: "/procesos/ingresos" },
  { key: "cuentas", label: "Cuentas", href: "/procesos/cuentas" },
  { key: "tarjetas", label: "Tarjetas", href: "/procesos/tarjetas" },
  { key: "transferencias", label: "Transferencias", href: "/procesos/transferencias" },
  { key: "cobros", label: "Cobros", href: "/procesos/cobros" },
  { key: "pendientes", label: "Pendientes", href: "/procesos/pendientes" },
] as const;

export type ShortcutKey = (typeof SHORTCUTS)[number]["key"];
export type Shortcut = (typeof SHORTCUTS)[number];

export const SHORTCUT_KEYS = SHORTCUTS.map((s) => s.key) as [ShortcutKey, ...ShortcutKey[]];

/** U11: como mucho 5 en la cinta (en el celular caben 4 a lo ancho y el quinto se desliza). */
export const MAX_FAVORITES = 5;

/** U11: lo que ve un usuario que nunca editó su cinta. */
export const DEFAULT_FAVORITES: readonly ShortcutKey[] = ["gastos", "ingresos", "cuentas", "tarjetas", "transferencias"];

function isShortcutKey(value: unknown): value is ShortcutKey {
  return typeof value === "string" && (SHORTCUT_KEYS as readonly string[]).includes(value);
}

/**
 * U11: lee los favoritos guardados. Ignora claves desconocidas y repetidas y
 * corta en el máximo; sin nada guardado (o con una lista inválida), los de
 * por defecto.
 */
export function readFavorites(raw: Record<string, unknown> | null | undefined): ShortcutKey[] {
  const value = raw?.favorites;
  if (!Array.isArray(value)) return [...DEFAULT_FAVORITES];
  const keys = [...new Set(value.filter(isShortcutKey))].slice(0, MAX_FAVORITES);
  return keys.length > 0 ? keys : [...DEFAULT_FAVORITES];
}

/** U11: valida la cinta que eligió el usuario (al menos 1, máximo 5, sin repetir). */
export function validateFavorites(keys: readonly string[]): ShortcutKey[] {
  if (keys.length === 0) throw new DomainError("U11", "Elige al menos un favorito");
  if (keys.length > MAX_FAVORITES) throw new DomainError("U11", `Elige como mucho ${MAX_FAVORITES} favoritos`);
  if (new Set(keys).size !== keys.length) throw new DomainError("U11", "Hay un favorito repetido");
  const unknown = keys.find((k) => !isShortcutKey(k));
  if (unknown) throw new DomainError("U11", "Ese acceso no existe");
  return keys as ShortcutKey[];
}

/**
 * U11 + E2: los accesos de la cinta que se pueden mostrar (los de una función
 * apagada no aparecen), en el orden guardado.
 */
export function visibleShortcuts(keys: readonly ShortcutKey[], isVisible: (href: string) => boolean): Shortcut[] {
  return keys
    .map((key) => SHORTCUTS.find((s) => s.key === key)!)
    .filter((s) => isVisible(s.href));
}
