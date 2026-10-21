"use client";

import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { DATE_FORMAT_COOKIE, formatDate, type DateFormatChoice } from "@/lib/format";

/**
 * U9 (3.1.0) · 3.2.0: formato de fecha del usuario para los client
 * components. Lo pone el layout de la app; fuera de él vale "corto". Así el
 * HTML del servidor y el del navegador coinciden y no hay estado compartido
 * entre usuarios.
 */
const DateFormatContext = createContext<DateFormatChoice>("corto");

export function DateFormatProvider({ value, children }: { value: DateFormatChoice; children: ReactNode }) {
  // 3.2.0: el servidor lee el formato de la cookie; si no coincide con el
  // perfil (otro dispositivo, otra sesión), se corrige para la próxima página.
  useEffect(() => {
    const current = document.cookie.match(new RegExp(`(?:^|; )${DATE_FORMAT_COOKIE}=([^;]*)`))?.[1];
    if (current !== value) document.cookie = `${DATE_FORMAT_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  }, [value]);
  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
}

/** `formatDate` con el formato del usuario. */
export function useFormatDate() {
  const choice = useContext(DateFormatContext);
  return useCallback((date: Date | string) => formatDate(date, choice), [choice]);
}
