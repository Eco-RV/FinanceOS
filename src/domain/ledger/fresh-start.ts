/**
 * Arranque de 0 (regla M8 en `docs/dominio/reglas.md`).
 *
 * Archiva todos los movimientos, borra financiamientos y préstamos (sus
 * cuotas ya cobradas quedan archivadas; las pendientes se borran) y crea un
 * saldo inicial nuevo por cada cuenta y tarjeta activa, que es lo único
 * visible después. Lo hace la persistencia de forma atómica; aquí vive la
 * regla de qué se exige antes de hacerlo.
 */

import { DomainError } from "../shared/errors.ts";
import type { Currency } from "../shared/money.ts";

/** Lo que el usuario tiene que escribir para confirmar (M8). */
export const FRESH_START_CONFIRMATION = "ARRANCAR";

/** Una cuenta (una moneda) o una tarjeta (CRC y USD, T1) activa. */
export type FreshStartProduct = {
  kind: "account" | "card";
  id: string;
  name: string;
  currencies: Currency[];
};

export type FreshStartOpening = {
  kind: "account" | "card";
  id: string;
  currency: Currency;
  /** Con signo; 0 = sin saldo. */
  amount: number;
};

export function isFreshStartConfirmed(text: string | null | undefined): boolean {
  return (text ?? "").trim().toUpperCase() === FRESH_START_CONFIRMATION;
}

/**
 * M8: rechaza sin la confirmación escrita y exige un saldo inicial (puede ser
 * 0) para cada cuenta y tarjeta activa, en cada una de sus monedas. Devuelve
 * solo los saldos distintos de 0, que son los movimientos a crear (C1).
 */
export function planFreshStart(input: {
  confirmation: string | null | undefined;
  products: FreshStartProduct[];
  openings: FreshStartOpening[];
}): FreshStartOpening[] {
  if (!isFreshStartConfirmed(input.confirmation)) {
    throw new DomainError("M8", `Escribe ${FRESH_START_CONFIRMATION} para confirmar el arranque de 0`);
  }

  const key = (o: { kind: string; id: string }, currency: string) => `${o.kind}:${o.id}:${currency}`;
  const given = new Map<string, FreshStartOpening>();
  for (const o of input.openings) {
    if (!Number.isFinite(o.amount)) {
      throw new DomainError("M8", "Hay un saldo inicial inválido");
    }
    given.set(key(o, o.currency), o);
  }

  const plan: FreshStartOpening[] = [];
  const expected = new Set<string>();
  for (const p of input.products) {
    for (const currency of p.currencies) {
      const k = key(p, currency);
      expected.add(k);
      const o = given.get(k);
      if (!o) {
        const where = p.currencies.length > 1 ? ` en ${currency}` : "";
        throw new DomainError("M8", `Falta el saldo inicial de "${p.name}"${where}`);
      }
      if (o.amount !== 0) plan.push(o);
    }
  }
  for (const k of given.keys()) {
    if (!expected.has(k)) {
      throw new DomainError("M8", "Hay un saldo inicial de una cuenta o tarjeta que no está activa");
    }
  }
  return plan;
}
