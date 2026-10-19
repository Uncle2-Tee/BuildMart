import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "buildmart_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function configuredCredentials() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  return username && password ? { username, password } : null;
}

function matches(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value, password) {
  return createHmac("sha256", password).update(value).digest("base64url");
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  };
}

export function verifyAdminCredentials(username, password) {
  const credentials = configuredCredentials();
  if (!credentials || typeof username !== "string" || typeof password !== "string") return false;
  return matches(username, credentials.username) && matches(password, credentials.password);
}

export function createAdminSessionToken() {
  const credentials = configuredCredentials();
  if (!credentials) throw new Error("Administrator credentials are not configured.");

  const payload = Buffer.from(JSON.stringify({
    username: credentials.username,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  })).toString("base64url");
  return `v1.${payload}.${sign(payload, credentials.password)}`;
}

export async function getAdminSession() {
  const credentials = configuredCredentials();
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!credentials || !token) return null;

  const [version, payload, signature, ...extra] = token.split(".");
  if (version !== "v1" || !payload || !signature || extra.length || !matches(signature, sign(payload, credentials.password))) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      session?.username !== credentials.username ||
      !Number.isInteger(session.expiresAt) ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { username: session.username };
  } catch {
    return null;
  }
}
