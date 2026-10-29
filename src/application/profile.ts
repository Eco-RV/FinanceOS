/**
 * Casos de uso de la cuenta del usuario (2.6.0): perfil, foto, preferencias,
 * correo y contraseña. Reglas U1–U6 del dominio.
 */

import {
  assertDeleteConfirmation,
  assertValidAvatar,
  assertValidPassword,
  normalizeNewEmail,
  validateFavorites,
  validateProfile,
  type ProfileFields,
} from "../domain/index.ts";
import type { AvatarStorage, IdentityService, ProfileRepository } from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

/** Guarda nombre, usuario (@) y país. */
export function saveProfile(
  profiles: ProfileRepository,
  input: ProfileFields,
): Promise<UseCaseResult<ProfileFields>> {
  return run(async () => {
    const fields = validateProfile(input);
    await profiles.save(fields);
    return ok(fields);
  });
}

/** U6: sube la foto y la deja como foto de perfil. */
export function updateAvatar(
  profiles: ProfileRepository,
  storage: AvatarStorage,
  file: { bytes: ArrayBuffer; type: string; size: number },
): Promise<UseCaseResult<{ url: string }>> {
  return run(async () => {
    assertValidAvatar(file);
    const url = await storage.upload({ bytes: file.bytes, type: file.type });
    await profiles.setAvatarUrl(url);
    return ok({ url });
  });
}

export function removeAvatar(
  profiles: ProfileRepository,
  storage: AvatarStorage,
): Promise<UseCaseResult> {
  return run(async () => {
    await storage.remove();
    await profiles.setAvatarUrl(null);
    return ok();
  });
}

export function savePreferences(
  profiles: ProfileRepository,
  preferences: Record<string, unknown>,
): Promise<UseCaseResult> {
  return run(async () => {
    await profiles.savePreferences(preferences);
    return ok();
  });
}

/** U11 (3.2.1): guarda la cinta de favoritos del Resumen, en el orden elegido. */
export function saveFavorites(profiles: ProfileRepository, keys: readonly string[]): Promise<UseCaseResult> {
  return run(async () => {
    await profiles.savePreferences({ favorites: validateFavorites(keys) });
    return ok();
  });
}

/**
 * U4: cambia la contraseña. Pide la actual, salvo al restablecerla desde el
 * enlace del correo (`current` = null: la sesión es de recuperación).
 */
export function changePassword(
  identity: IdentityService,
  input: { current: string | null; next: string },
): Promise<UseCaseResult> {
  return run(async () => {
    assertValidPassword(input.next, input.current ?? undefined);
    if (input.current === null) {
      // Sin la actual solo desde el enlace de recuperación.
      if (!(await identity.isRecoverySession())) {
        return fail("El enlace para restablecer venció. Pide uno nuevo.", "U4");
      }
    } else if (!(await identity.verifyPassword(input.current))) {
      return fail("La contraseña actual no es correcta", "U4");
    }
    await identity.changePassword(input.next);
    return ok();
  });
}

/** U5: pide el cambio de correo; se confirma desde el enlace que llega por correo. */
export function changeEmail(
  identity: IdentityService,
  input: { email: string; redirectTo: string },
): Promise<UseCaseResult<{ email: string }>> {
  return run(async () => {
    const email = normalizeNewEmail(input.email, await identity.email());
    await identity.changeEmail(email, input.redirectTo);
    return ok({ email });
  });
}

/**
 * U8 (3.1.0): borra la cuenta. Pide escribir ELIMINAR y la contraseña actual;
 * después no hay vuelta atrás (se borran movimientos, planes, metas, archivos…).
 */
export function deleteAccount(
  deps: { identity: IdentityService },
  input: { confirmation: string; password: string },
): Promise<UseCaseResult> {
  return run(async () => {
    assertDeleteConfirmation(input.confirmation);
    if (!input.password) return fail("Escribe tu contraseña", "U8");
    if (!(await deps.identity.verifyPassword(input.password))) return fail("La contraseña no es correcta", "U8");
    await deps.identity.deleteAccount();
    return ok();
  });
}

/** I7 (3.3.0): enciende o apaga la aceptación automática de las compras del correo. */
export function saveAutoApprove(profiles: ProfileRepository, on: boolean): Promise<UseCaseResult> {
  return run(async () => {
    await profiles.savePreferences({ autoApprovePending: on });
    return ok();
  });
}
