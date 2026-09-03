/**
 * Día calendario actual en Costa Rica (UTC-6, sin horario de verano), como Date a
 * medianoche local. Úsalo como referencia de "hoy" en vez de `new Date()` para que
 * los cálculos no dependan de la zona horaria del servidor (Vercel corre en UTC).
 */
export function crToday(): Date {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
