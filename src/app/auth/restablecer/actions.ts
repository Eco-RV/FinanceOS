"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { changePassword } from "@/application";
import { repositories } from "@/infrastructure/container";
import type { FormResult } from "@/lib/forms";

/** Contraseña nueva desde el enlace de "¿la olvidaste?" (sin pedir la actual). */
export async function resetPassword(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const next = String(formData.get("password") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) {
    return { ok: false, errors: { confirm: "Las contraseñas no coinciden" } };
  }
  const { identity } = await repositories();
  const result = await changePassword(identity, { current: null, next });
  if (!result.ok) return { ok: false, message: result.message };
  redirect("/dashboard?aviso=contrasena-actualizada");
}
