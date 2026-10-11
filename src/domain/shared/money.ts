/**
 * Dinero = monto + moneda (glosario: "Monto"). Internamente en **céntimos
 * enteros** para no acumular errores de redondeo de punto flotante.
 */

import { DomainError } from "./errors.ts";

export const CURRENCIES = ["CRC", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export type Money = {
  readonly cents: number;
  readonly currency: Currency;
};

/** Monto decimal (p. ej. 1250.5) → céntimos enteros, redondeando a 2 decimales. */
export function toCents(amount: number): number {
  return Math.round((Number(amount) || 0) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function money(amount: number, currency: Currency): Money {
  return { cents: toCents(amount), currency };
}

export function moneyFromCents(cents: number, currency: Currency): Money {
  return { cents: Math.round(cents), currency };
}

export function zero(currency: Currency): Money {
  return { cents: 0, currency };
}

/** Monto decimal de un `Money` (para mostrar o persistir). */
export function amountOf(m: Money): number {
  return fromCents(m.cents);
}

/** G3: no se mezclan monedas sin tipo de cambio explícito. */
export function assertSameCurrency(a: Currency, b: Currency, rule = "G3"): void {
  if (a !== b) {
    throw new DomainError(
      rule,
      `No se pueden combinar montos en ${a} y ${b} sin tipo de cambio`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a.currency, b.currency);
  return { cents: a.cents + b.cents, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a.currency, b.currency);
  return { cents: a.cents - b.cents, currency: a.currency };
}

export function sum(items: Money[], currency: Currency): Money {
  return items.reduce((acc, m) => add(acc, m), zero(currency));
}

export function isPositive(m: Money): boolean {
  return m.cents > 0;
}

/**
 * Reparte un total en `parts` partes iguales en céntimos; el residuo se lo
 * lleva la **última** parte, así la suma cierra exacto al total.
 */
export function splitEvenly(total: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new DomainError("G2", "La cantidad de partes debe ser un entero ≥ 1");
  }
  const base = Math.trunc(total.cents / parts);
  const remainder = total.cents - base * parts;
  return Array.from({ length: parts }, (_, i) =>
    moneyFromCents(base + (i === parts - 1 ? remainder : 0), total.currency),
  );
}

/** Convierte con un tipo de cambio explícito (`rate` = unidades de `to` por 1 de `from`). */
export function convert(m: Money, to: Currency, rate: number): Money {
  if (m.currency === to) return m;
  if (!(rate > 0)) {
    throw new DomainError("G3", "El tipo de cambio debe ser mayor que 0");
  }
  return moneyFromCents(Math.round(m.cents * rate), to);
}
