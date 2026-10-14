import { LifecycleButton } from "@/components/lifecycle-button";
import type { FormResult } from "@/lib/forms";

type Action = (formData: FormData) => Promise<FormResult>;

/**
 * G5 en una fila activa: "Eliminar" si no tiene historia; si la tiene,
 * "Desactivar" (la conserva y deja de ofrecerse para registrar).
 */
export function RemoveOrDeactivate({
  id,
  label,
  hasHistory,
  onDelete,
  onSetActive,
  deactivateNote,
}: {
  id: string;
  /** Con artículo: `la cuenta "BCR"`. */
  label: string;
  hasHistory: boolean;
  onDelete: Action;
  onSetActive: Action;
  /** Qué implica desactivar, agregado a la confirmación. */
  deactivateNote?: string;
}) {
  return hasHistory ? (
    <LifecycleButton
      id={id}
      mode="deactivate"
      action={onSetActive}
      confirmLabel={`¿Desactivar ${label}? Tiene historia, así que se conserva; deja de ofrecerse para registrar y se puede activar de nuevo.${deactivateNote ? ` ${deactivateNote}` : ""}`}
    />
  ) : (
    <LifecycleButton
      id={id}
      mode="delete"
      action={onDelete}
      confirmLabel={`¿Eliminar ${label}?`}
    />
  );
}

export type InactiveItem = {
  id: string;
  name: string;
  detail?: string;
  hasHistory: boolean;
};

/** Lista de lo desactivado: reactivar o, si no tiene historia, eliminar. */
export function InactiveList({
  title = "Desactivadas",
  items,
  noun,
  onDelete,
  onSetActive,
}: {
  title?: string;
  items: InactiveItem[];
  /** Con artículo, sin nombre: "la cuenta". */
  noun: string;
  onDelete: Action;
  onSetActive: Action;
}) {
  if (items.length === 0) return null;
  return (
    <details className="surface p-3 text-sm">
      <summary className="cursor-pointer rounded-sm text-muted-foreground transition-colors select-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring">
        {title} ({items.length})
      </summary>
      <ul className="mt-2 flex flex-col divide-y">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="truncate font-medium text-muted-foreground">{item.name}</div>
              {item.detail ? (
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <LifecycleButton id={item.id} mode="activate" action={onSetActive} />
              {item.hasHistory ? null : (
                <LifecycleButton
                  id={item.id}
                  mode="delete"
                  action={onDelete}
                  confirmLabel={`¿Eliminar ${noun} "${item.name}"?`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
