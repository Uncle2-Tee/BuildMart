import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
  verifyAdminCredentials,
} from "../../../../lib/admin-session";
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

  if (!verifyAdminCredentials(username, password)) {
    return Response.json({ error: "Invalid administrator credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), getAdminSessionCookieOptions());
  return response;
}
