import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function proxy(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isAuthPage = ["/login", "/signup", "/account", "/forgot-password"].includes(pathname);
  const isPaymentCallback = [
    "/api/payments/paystack/verify",
    "/api/payments/paystack/webhook",
  ].includes(pathname);
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && error.name !== "AuthSessionMissingError") {
    console.error("Unable to verify request session", error);
    if (pathname.startsWith("/api/") && !isPaymentCallback) {
      return Response.json({ error: "Unable to verify your account." }, { status: 503 });
    }
    return new Response("Unable to verify your account. Please try again.", { status: 503 });
  }

  if (!user && !isAuthPage && !isPaymentCallback) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Sign in to continue." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
