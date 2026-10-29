import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/mail/outlook";

export const dynamic = "force-dynamic";

/** 3.3.0: conectar Outlook personal (Microsoft Graph, solo lectura). */
export async function GET(request: NextRequest) {
  await requireUser();

  const state = crypto.randomUUID();
  const redirectUri = `${request.nextUrl.origin}/api/outlook/callback`;

  let url: string;
  try {
    url = buildAuthUrl(redirectUri, state);
  } catch {
    return NextResponse.redirect(
      new URL("/ajustes/bancos?outlook=sin-config", request.nextUrl.origin),
    );
  }

  const response = NextResponse.redirect(url);
  response.cookies.set("outlook_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/outlook",
  });
  return response;
}
