import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
  verifyAdminCredentials,
} from "../../../../lib/admin-session";
import {
  checkLoginProtection,
  clearLoginFailures,
  getLoginAccountKey,
  loginProtectionUnavailableResponse,
  recordLoginFailure,
  tooManyLoginAttemptsResponse,
} from "../../../../lib/login-protection";
import { isSameOriginRequest } from "../../../../lib/request-origin";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter your administrator username and password." }, { status: 400 });
  }

  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password || username.length > 200 || password.length > 512) {
    return Response.json({ error: "Enter your administrator username and password." }, { status: 400 });
  }

  const accountKey = getLoginAccountKey("admin", username);
  const protection = await checkLoginProtection(request, accountKey);
  if (protection.error) return loginProtectionUnavailableResponse();
  if (protection.blocked) return tooManyLoginAttemptsResponse(protection.retryAfter);

  if (!verifyAdminCredentials(username, password)) {
    const failure = await recordLoginFailure(accountKey);
    if (failure.error) return loginProtectionUnavailableResponse();
    return Response.json({ error: "Invalid administrator credentials." }, { status: 401 });
  }

  const cleared = await clearLoginFailures(accountKey);
  if (cleared.error) return loginProtectionUnavailableResponse();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), getAdminSessionCookieOptions());
  return response;
}
