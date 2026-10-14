/**
 * Clases de interacción compartidas (2.4.0). Literales completos para que
 * Tailwind los detecte. El foco usa `outline` (no `ring`) para no competir con
 * el borde de las superficies, que es un `ring`.
 */

/** Foco de teclado visible para enlaces y superficies clicables. */
export const FOCUS_OUTLINE =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Superficie-enlace (card): se eleva al pasar el cursor y se hunde al presionar. */
export const PRESSABLE_SURFACE =
  "group/link transition-[translate,scale,box-shadow,background-color] duration-200 ease-fluid hover:shadow-card-hover active:shadow-card active:duration-100 motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.985]";

/** Fila-enlace dentro de una lista: fondo al pasar el cursor y al presionar. */
export const PRESSABLE_ROW =
  "group/link transition-colors duration-150 ease-fluid hover:bg-muted/60 active:bg-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring";
