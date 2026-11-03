import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const sessionMaxAge = 365 * 24 * 60 * 60;

export async function proxy(request) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return response;

  const hasAuthSession = request.cookies
    .getAll()
    .some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
  if (!hasAuthSession) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, { ...options, maxAge: sessionMaxAge });
        }
      },
    },
  });

  try {
    await supabase.auth.getClaims();
  } catch (error) {
    console.error("Unable to refresh Supabase session", error);
  }

  return response;
}

export const config = {
  matcher: ["/account", "/dashboard/:path*"],
};
