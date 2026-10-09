import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/mail/gmail";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireUser();

  const state = crypto.randomUUID();
  const redirectUri = `${request.nextUrl.origin}/api/gmail/callback`;

  let url: string;
  try {
    url = buildAuthUrl(redirectUri, state);
  } catch {
    return NextResponse.redirect(
      new URL("/ajustes/bancos?gmail=sin-config", request.nextUrl.origin),
    );
  }

  const response = NextResponse.redirect(url);
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/gmail",
  });
  return response;
}
