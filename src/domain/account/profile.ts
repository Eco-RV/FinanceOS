/**
 * Cuenta del usuario (2.6.0): perfil opcional (nombre, usuario, país, foto),
 * correo y contraseña. Reglas U1–U6 en `docs/dominio/reglas.md`.
 */

import { DomainError } from "../shared/errors.ts";

export type ProfileFields = {
  full_name: string | null;
  username: string | null;
  /** ISO 3166-1 alfa-2 en mayúsculas ("CR"). */
  country: string | null;
};

/** U1: 3–30 caracteres; letras minúsculas, números, punto y guion bajo; sin empezar ni terminar en signo. */
const USERNAME = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$/;

export const PASSWORD_MIN = 8;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;

/** "  @Oswald.R " → "oswald.r"; vacío → null. */
export function normalizeUsername(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/^@+/, "").toLowerCase();
  return v === "" ? null : v;
}

function clean(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/\s+/g, " ");
  return v === "" ? null : v;
}

/** Normaliza y valida el perfil. Todo es opcional. */
export function validateProfile(input: ProfileFields): ProfileFields {
  const full_name = clean(input.full_name);
  if (full_name && full_name.length > 80) {
    throw new DomainError("U2", "El nombre puede tener hasta 80 caracteres");
  }
  const username = normalizeUsername(input.username);
  if (username && !USERNAME.test(username)) {
    throw new DomainError(
      "U1",
      "El usuario lleva de 3 a 30 caracteres: letras, números, punto o guion bajo, sin empezar ni terminar en signo",
    );
  }
  const country = clean(input.country)?.toUpperCase() ?? null;
  if (country && !/^[A-Z]{2}$/.test(country)) {
    throw new DomainError("U3", "País inválido");
  }
  return { full_name, username, country };
}

/** U4: contraseña nueva de 8+ caracteres, con letras y números, distinta de la actual. */
export function assertValidPassword(next: string, current?: string): void {
  if (next.length < PASSWORD_MIN || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
    throw new DomainError(
      "U4",
      `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres, con letras y números`,
    );
  }
  if (current !== undefined && next === current) {
    throw new DomainError("U4", "La contraseña nueva debe ser distinta de la actual");
  }
}

/** U5: el correo nuevo es válido y distinto del actual (sin importar mayúsculas). */
export function normalizeNewEmail(next: string, current: string | null): string {
  const email = next.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainError("U5", "Correo inválido");
  }
  if (current && email === current.trim().toLowerCase()) {
    throw new DomainError("U5", "Ese ya es tu correo");
  }
  return email;
}

/** U6: la foto es una imagen WebP, JPEG o PNG de hasta 2 MB. */
export function assertValidAvatar(file: { size: number; type: string }): void {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
    throw new DomainError("U6", "La foto debe ser una imagen JPG, PNG o WebP");
  }
  if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) {
    throw new DomainError("U6", "La foto puede pesar hasta 2 MB");
  }
}

/** Iniciales para el avatar: del nombre ("Oswald Reid" → "OR") o del correo. */
export function initialsOf(fullName: string | null | undefined, email: string): string {
  const name = clean(fullName);
  if (name) {
    const words = name.split(" ").filter(Boolean);
    const raw = words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.slice(0, 2);
    return raw.toUpperCase();
  }
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "?";
  const parts = local.split(/[.\-_+]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2)).toUpperCase();
}
