import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PERF_ENABLED, timedFetch } from "@/lib/perf";

/**
 * Supabase client for use in Server Components, Route Handlers and Server Actions.
 * Must be awaited because `cookies()` is async in Next.js 16.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 3.2.0 · Fase 1.1: con PERF_LOG=1 cada consulta queda en el log de tiempos.
      ...(PERF_ENABLED ? { global: { fetch: timedFetch } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component. This can be ignored
            // when `proxy.ts` refreshes the session on every request.
          }
        },
      },
    },
  );
}
