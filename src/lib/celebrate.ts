/** Evento que escucha `<Celebration />` (montado en el layout raíz). */
export const CELEBRATE_EVENT = "financeos:celebrate";

export type CelebrateDetail = { message: string; detail?: string };

/** Muestra la confirmación animada al centro ("Gasto registrado"). Solo en el cliente. */
export function celebrate(message: string, detail?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CelebrateDetail>(CELEBRATE_EVENT, { detail: { message, detail } }),
  );
}
