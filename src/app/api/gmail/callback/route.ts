import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { replaceConnection } from "@/lib/mail/connection";
import { exchangeCode, getProfileEmail } from "@/lib/mail/gmail";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const { origin, searchParams } = request.nextUrl;
  const back = (status: string) =>
    NextResponse.redirect(new URL(`/ajustes/bancos?gmail=${status}`, origin));

  const state = searchParams.get("state");
  const code = searchParams.get("code");
  const expected = request.cookies.get("gmail_oauth_state")?.value;

  if (searchParams.get("error") || !code || !state || state !== expected) {
    return back("cancelado");
  }

  try {
    const tokens = await exchangeCode(code, `${origin}/api/gmail/callback`);
    if (!tokens.refresh_token) return back("sin-token");

    const email = await getProfileEmail(tokens.access_token);
    // 3.3.0: una conexión por usuario; reemplaza la anterior (p. ej. Outlook).
    const saved = await replaceConnection(await createClient(), user.id, {
      provider: "gmail",
      email,
      refreshToken: tokens.refresh_token,
      scopes: tokens.scope ?? null,
    });
    if (!saved) return back("error");
  } catch {
    return back("error");
  }

  const response = back("ok");
  response.cookies.delete({ name: "gmail_oauth_state", path: "/api/gmail" });
  return response;
}
