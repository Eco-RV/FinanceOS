/**
 * PostgREST devuelve como máximo ~1000 filas por consulta. Para lecturas que
 * necesitan TODAS las filas (p. ej. los movimientos de tarjeta del estado de
 * cuenta), se pide página por página en un orden estable.
 */
const PAGE = 1000;

export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error || !data) return rows;
    rows.push(...(data as T[]));
    if (data.length < PAGE) return rows;
  }
}
