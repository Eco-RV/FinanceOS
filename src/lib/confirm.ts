/**
 * Confirmación con el diálogo de la app (2.5.0), en vez de `window.confirm`.
 * `<ConfirmHost />` (layout raíz) escucha el evento y resuelve la promesa con
 * la respuesta del usuario. Solo en el cliente.
 */

export const CONFIRM_EVENT = "financeos:confirm";

export type ConfirmTone = "danger" | "warning" | "default";

export type ConfirmOptions = {
  /** Pregunta corta ("¿Eliminar este movimiento?"). */
  title: string;
  /** Consecuencias, en texto normal. */
  description?: string;
  /** Texto del botón que confirma (por defecto "Confirmar"). */
  confirmLabel?: string;
  tone?: ConfirmTone;
  /** Ícono: "delete" | "archive" | "undo" (por defecto según el tono). */
  icon?: "delete" | "archive" | "undo";
};

export type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<ConfirmRequest>(CONFIRM_EVENT, { detail: { ...options, resolve } }),
    );
  });
}

/**
 * "¿Desactivar X? Tiene historia, así que…" → título hasta el primer "?" y el
 * resto como descripción (los textos de confirmación ya vienen así).
 */
export function splitQuestion(text: string): { title: string; description?: string } {
  const i = text.indexOf("?");
  if (i < 0 || i === text.length - 1) return { title: text };
  return { title: text.slice(0, i + 1), description: text.slice(i + 1).trim() || undefined };
}
