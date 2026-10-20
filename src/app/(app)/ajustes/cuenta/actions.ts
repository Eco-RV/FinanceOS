"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { confirmUrl } from "@/lib/site-url";
import type { FormResult } from "@/lib/forms";
import { redirect } from "next/navigation";
import {
  deleteAccount,
  changeEmail,
  changePassword,
  removeAvatar,
  saveProfile,
  updateAvatar,
} from "@/application";
import { repositories } from "@/infrastructure/container";

function revalidate() {
  // Nombre y foto salen en la barra de todas las páginas.
  revalidatePath("/", "layout");
}

function text(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" ? v : null;
}

/** Nombre, usuario (@) y país. */
export async function saveProfileAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const { profiles } = await repositories();
  const result = await saveProfile(profiles, {
    full_name: text(formData, "full_name"),
    username: text(formData, "username"),
    country: text(formData, "country"),
  });
  if (!result.ok) {
    const field = result.rule === "U1" ? "username" : result.rule === "U2" ? "full_name" : undefined;
    return field
      ? { ok: false, errors: { [field]: result.message } }
      : { ok: false, message: result.message };
  }
  revalidate();
  return { ok: true };
}

/** Foto ya recortada en el navegador (512 px, WebP). */
export async function uploadAvatarAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const file = formData.get("avatar");
  if (!(file instanceof File)) return { ok: false, message: "Elige una imagen" };
  const { profiles, avatars } = await repositories();
  const result = await updateAvatar(profiles, avatars, {
    bytes: await file.arrayBuffer(),
    type: file.type,
    size: file.size,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidate();
  return { ok: true };
}

export async function removeAvatarAction(): Promise<FormResult> {
  await requireUser();
  const { profiles, avatars } = await repositories();
  const result = await removeAvatar(profiles, avatars);
  if (!result.ok) return { ok: false, message: result.message };
  revalidate();
  return { ok: true };
}

/** U5: el cambio se completa desde el enlace que llega al correo nuevo. */
export async function changeEmailAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const { identity } = await repositories();
  const result = await changeEmail(identity, {
    email: text(formData, "email") ?? "",
    redirectTo: await confirmUrl("/ajustes/cuenta?aviso=correo-actualizado"),
  });
  if (!result.ok) return { ok: false, errors: { email: result.message } };
  return { ok: true };
}

/** U4: pide la contraseña actual. */
export async function changePasswordAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const next = text(formData, "password") ?? "";
  if (next !== text(formData, "confirm")) {
    return { ok: false, errors: { confirm: "Las contraseñas no coinciden" } };
  }
  const { identity } = await repositories();
  const result = await changePassword(identity, { current: text(formData, "current") ?? "", next });
  if (!result.ok) {
    return /actual/.test(result.message)
      ? { ok: false, errors: { current: result.message } }
      : { ok: false, errors: { password: result.message } };
  }
  return { ok: true };
}

/** U8 (3.1.0): borra la cuenta y todos sus datos; luego vuelve al login. */
export async function deleteAccountAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { identity } = await repositories();
  const result = await deleteAccount(
    { identity },
    { confirmation: text(formData, "confirmation") ?? "", password: text(formData, "password") ?? "" },
  );
  if (!result.ok) return { ok: false, message: result.message };
  redirect("/login?aviso=cuenta-eliminada");
}
