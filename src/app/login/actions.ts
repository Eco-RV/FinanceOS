"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { confirmUrl, safeNext } from "@/lib/site-url";
import { assertValidPassword, DomainError } from "@/domain";

/**
 * Resultado de los formularios de acceso (2.6.0). `notice` cambia la vista:
 * "confirm-email" = cuenta creada, falta confirmar el correo; "reset-sent" =
 * se mandó el enlace para restablecer la contraseña; "resent" = se reenvió la
 * confirmación. `unconfirmed` = el correo existe pero no está confirmado.
 */
export type AuthState =
  | {
      error?: string;
      field?: "email" | "password" | "confirm" | "full_name";
      notice?: "confirm-email" | "reset-sent" | "resent";
      unconfirmed?: boolean;
      email?: string;
    }
  | undefined;

const email = z.string().trim().toLowerCase().email("Escribe un correo válido");

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Escribe tu contraseña"),
});

const signUpSchema = z
  .object({
    full_name: z.string().trim().max(80, "Hasta 80 caracteres").optional(),
    email,
    password: z.string(),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  });

function firstIssue(error: z.ZodError): AuthState {
  const issue = error.issues[0];
  return {
    error: issue?.message ?? "Datos inválidos",
    field: issue?.path[0] as NonNullable<AuthState>["field"],
  };
}

function isUnconfirmed(message: string) {
  return /not confirmed/i.test(message);
}

function isRateLimited(message: string) {
  return /rate limit|security purposes|too many/i.test(message);
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (isUnconfirmed(error.message)) {
      return {
        error: "Tu correo todavía no está confirmado. Abre el enlace que te enviamos.",
        unconfirmed: true,
        email: parsed.data.email,
      };
    }
    if (isRateLimited(error.message)) {
      return { error: "Demasiados intentos. Espera un momento e inténtalo de nuevo." };
    }
    return { error: "Correo o contraseña incorrectos", field: "password", email: parsed.data.email };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next") as string | null));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    full_name: formData.get("full_name") ?? undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    assertValidPassword(parsed.data.password);
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, field: "password" };
    throw e;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Vuelve a esta misma app (producción o local), no al "Site URL" de Supabase.
      emailRedirectTo: await confirmUrl("/dashboard?aviso=bienvenida"),
      data: parsed.data.full_name ? { full_name: parsed.data.full_name } : undefined,
    },
  });

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { error: "Ya existe una cuenta con ese correo. Inicia sesión.", field: "email" };
    }
    if (isRateLimited(error.message)) {
      return { error: "Se enviaron muchos correos seguidos. Espera unos minutos e inténtalo de nuevo." };
    }
    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  // Con confirmación de correo activa, Supabase no revela si el correo ya
  // existía: devuelve un usuario sin identidades y no manda nada.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Ya existe una cuenta con ese correo. Inicia sesión.", field: "email" };
  }

  // Sin sesión = hay que confirmar el correo: la cuenta sí se creó.
  if (!data.session) return { notice: "confirm-email", email: parsed.data.email };

  revalidatePath("/", "layout");
  redirect("/dashboard?aviso=bienvenida");
}

/** Reenvía el correo de confirmación del registro. */
export async function resendConfirmation(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Escribe un correo válido", field: "email" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: await confirmUrl("/dashboard?aviso=bienvenida") },
  });
  if (error) {
    return {
      error: isRateLimited(error.message)
        ? "Espera un minuto antes de pedir otro correo."
        : "No se pudo reenviar el correo.",
      notice: "confirm-email",
      email: parsed.data,
    };
  }
  return { notice: "resent", email: parsed.data };
}

/** Manda el enlace para restablecer la contraseña. */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Escribe un correo válido", field: "email" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: await confirmUrl("/auth/restablecer"),
  });
  if (error && isRateLimited(error.message)) {
    return { error: "Espera un minuto antes de pedir otro correo.", email: parsed.data };
  }
  // Por seguridad no se dice si el correo existe.
  return { notice: "reset-sent", email: parsed.data };
}

/**
 * U10 (3.0.1): entrar o registrarse con Google (OAuth de Supabase). Vuelve por
 * `/auth/confirm?code=…` (PKCE). Requiere activar el proveedor Google en
 * Supabase → Authentication → Providers.
 */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const next = safeNext((formData.get("next") as string) || null);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await confirmUrl(next) },
  });
  if (error || !data.url) redirect("/login?aviso=google-no-disponible");
  redirect(data.url);
}
