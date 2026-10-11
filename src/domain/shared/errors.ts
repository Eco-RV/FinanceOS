/**
 * Violación de una regla de negocio (ver `docs/dominio/reglas.md`). `rule` es
 * el identificador de la regla (p. ej. "M5") para poder rastrearla.
 */
export class DomainError extends Error {
  readonly rule: string;

  constructor(rule: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.rule = rule;
  }
}
