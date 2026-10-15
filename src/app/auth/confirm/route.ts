import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Destino de los enlaces que Supabase manda por correo (2.6.0): confirmar el
 * registro, confirmar un cambio de correo o restablecer la contraseña.
 *
 * Acepta las dos formas de enlace:
 * - `?token_hash=…&type=…` (plantilla de correo con `{{ .TokenHash }}`): se
 *   verifica aquí y funciona aunque el correo se abra en otro dispositivo.
 * - `?code=…` (enlace por defecto, PKCE): Supabase ya verificó el correo
 *   antes de redirigir; se cambia el código por la sesión. Si el enlace se
 *   abrió en otro navegador no hay sesión, pero el correo quedó confirmado.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const type = searchParams.get("type") as EmailOtpType | null;
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const recovery = type === "recovery" || searchParams.get("next")?.startsWith("/auth/restablecer");
  const next = safeNext(searchParams.get("next"), recovery ? "/auth/restablecer" : "/dashboard");
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));
  const toLogin = (aviso: string) => to(`/login?aviso=${aviso}`);

  // Supabase rechazó el enlace antes de llegar aquí (vencido o ya usado).
  if (searchParams.get("error") || searchParams.get("error_code")) {
    return toLogin("enlace-invalido");
  }

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return toLogin("enlace-invalido");
    return to(withNotice(next, type));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return toLogin(recovery ? "enlace-invalido" : "correo-confirmado");
    return to(withNotice(next, type));
  }

  return toLogin("enlace-invalido");
}

/** Mensaje para la pantalla de destino según lo que se confirmó. */
function withNotice(next: string, type: string | null): string {
  if (type === "email_change") return addParam(next, "aviso", "correo-actualizado");
  if (type === "signup" || type === "email") return addParam(next, "aviso", "bienvenida");
  return next;
}

function addParam(path: string, key: string, value: string): string {
  if (path.includes(`${key}=`)) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;
}
