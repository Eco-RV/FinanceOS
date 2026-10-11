import { DomainError } from "../domain/index.ts";
import { InfrastructureError } from "./ports.ts";

/** Resultado de un caso de uso: éxito con datos, o un mensaje para el usuario. */
export type UseCaseResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; message: string; rule?: string };

export function ok<T>(value: T): UseCaseResult<T>;
export function ok(): UseCaseResult<undefined>;
export function ok<T>(value?: T): UseCaseResult<T | undefined> {
  return { ok: true, value };
}

export function fail(message: string, rule?: string): { ok: false; message: string; rule?: string } {
  return { ok: false, message, rule };
}

/**
 * Ejecuta un caso de uso convirtiendo `DomainError` e `InfrastructureError` en
 * un resultado fallido; cualquier otro error se propaga (es un bug).
 */
export async function run<T>(fn: () => Promise<UseCaseResult<T>>): Promise<UseCaseResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DomainError) return fail(e.message, e.rule);
    if (e instanceof InfrastructureError) return fail(e.message);
    throw e;
  }
}
