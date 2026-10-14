import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/mail/crypto";
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
    const supabase = await createClient();
    const { error } = await supabase.from("mail_connections").upsert(
      {
        user_id: user.id,
        provider: "gmail",
        email,
        refresh_token_enc: encryptToken(tokens.refresh_token),
        scopes: tokens.scope ?? null,
        last_synced_at: null,
      },
      { onConflict: "user_id,provider" },
    );
    if (error) return back("error");
  } catch {
    return back("error");
  }

  const response = back("ok");
  response.cookies.delete({ name: "gmail_oauth_state", path: "/api/gmail" });
  return response;
}
