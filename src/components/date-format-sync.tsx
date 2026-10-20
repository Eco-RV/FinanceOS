"use client";

import { setDateFormat, type DateFormatChoice } from "@/lib/format";

/**
 * U9 (3.1.0): fija el formato de fecha en el navegador antes de que se pinten
 * los demás componentes (va primero en el layout). No pinta nada.
 */
export function DateFormatSync({ value }: { value: DateFormatChoice }) {
  setDateFormat(value);
  return null;
}
