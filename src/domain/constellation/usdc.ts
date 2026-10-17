/**
 * Montos de la Constelación (2.9.0). En Stellar los activos tienen **7
 * decimales** (K10): en la cadena un monto es un entero (`i128`/stroops). La
 * app muestra céntimos, truncados hacia abajo para nunca mostrar de más.
 */

import { DomainError } from "../shared/errors.ts";

export const STELLAR_DECIMALS = 7;
const SCALE = BigInt(10) ** BigInt(STELLAR_DECIMALS);

/**
 * "12,5" / "12.5" / "1.234,56" → unidades de 7 decimales (`bigint`). El último
 * separador es el decimal. Rechaza montos ≤ 0 o con más de 7 decimales.
 */
export function parseStellarAmount(raw: string): bigint {
  const cleaned = raw.trim().replace(/\s/g, "").replace(/,/g, ".");
  const last = cleaned.lastIndexOf(".");
  const intPart = last < 0 ? cleaned : cleaned.slice(0, last).replace(/\./g, "");
  const fracPart = last < 0 ? "" : cleaned.slice(last + 1);
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart) || (intPart + fracPart).length === 0) {
    throw new DomainError("G2", "Monto inválido");
  }
  if (fracPart.length > STELLAR_DECIMALS) {
    throw new DomainError("K10", "Máximo 7 decimales");
  }
  const units =
    BigInt(intPart || "0") * SCALE + BigInt((fracPart + "0".repeat(STELLAR_DECIMALS)).slice(0, STELLAR_DECIMALS));
  if (units <= BigInt(0)) throw new DomainError("G2", "El monto debe ser mayor que 0");
  return units;
}

/** Unidades de 7 decimales → texto exacto para la red ("12.5000000"). */
export function formatStellarAmount(units: bigint): string {
  const negative = units < BigInt(0);
  const abs = negative ? -units : units;
  const int = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(STELLAR_DECIMALS, "0");
  return `${negative ? "-" : ""}${int}.${frac}`;
}

/**
 * Saldo de Horizon ("12.3456789") → número con 2 decimales, truncado hacia
 * abajo (K10), para mostrar.
 */
export function displayStellarBalance(balance: string | number | null | undefined): number {
  const n = Number(balance ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n * 100) / 100;
}
