import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Paths reachable without an authenticated session. `/api/sync-mail` no lleva
 * sesión de usuario: la protege un secreto Bearer (CRON_SECRET) en la propia ruta.
 */
// 3.2.0: "/" es la página de inicio pública (con sesión, la página manda al Resumen).
const PUBLIC_PATHS = ["/", "/login", "/auth", "/privacidad", "/terminos", "/api/sync-mail"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * Refreshes the Supabase auth session on every request and gates access.
 * Adapted from the Supabase SSR guide for the Next.js 16 `proxy` convention.
 */
export async function updateSession(request: NextRequest) {
  // 3.2.0 · Fase 1.1: la ruta para el log de tiempos (`src/lib/perf.ts`).
  request.headers.set("x-fo-path", request.nextUrl.pathname);
  let response = NextResponse.next({ request });

  // Before Supabase is configured, let every request through so the app still boots.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getClaims().
  // 3.2.0 · Fase 1.2: `getClaims()` refresca la sesión si hace falta y valida
  // el JWT en local cuando el proyecto usa JWT Signing Keys (asimétricas); así
  // la navegación y cada prefetch no esperan un viaje a Supabase Auth.
  const authStart = performance.now();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;
  const authMs = Math.round(performance.now() - authStart);

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 3.2.0 · Fase 1.1: cuánto tardó el proxy en validar la sesión (DevTools → Network → Timing).
  response.headers.set("Server-Timing", `proxy-auth;dur=${authMs}`);
  if (process.env.PERF_LOG === "1") console.log(`[perf] proxy ${request.nextUrl.pathname} auth=${authMs}ms`);
  return response;
}
