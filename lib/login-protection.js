import "server-only";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "./supabase/admin";

const RETRY_AFTER_FALLBACK_SECONDS = 15 * 60;

export function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedIp || realIp || "unknown";
  return ip.slice(0, 200);
}

export function getLoginAccountKey(scope, identifier) {
  return `${scope}:${identifier.trim().normalize("NFKC").toLocaleLowerCase()}`.slice(0, 300);
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

function retryAfterSeconds(value) {
  return Math.max(1, Number.isInteger(value) ? value : RETRY_AFTER_FALLBACK_SECONDS);
}

async function callProtectionRpc(name, params) {
  if (!isSupabaseAdminConfigured()) {
    return { error: new Error("Login protection requires Supabase service-role configuration.") };
  }

  const { data, error } = await createSupabaseAdminClient().rpc(name, params);
  if (error) {
    console.error(`Login protection RPC ${name} failed`, error);
    return { error: new Error("Login protection is temporarily unavailable.") };
  }
  return { data: firstRow(data) };
}

export async function checkLoginProtection(request, accountKey) {
  const ipResult = await callProtectionRpc("consume_login_ip_rate_limit", {
    p_ip: getClientIp(request),
  });
  if (ipResult.error) return ipResult;

  if (!ipResult.data?.allowed) {
    return {
      blocked: true,
      retryAfter: retryAfterSeconds(ipResult.data?.retry_after_seconds),
    };
  }

  const accountResult = await callProtectionRpc("check_login_account_lockout", {
    p_account_key: accountKey,
  });
  if (accountResult.error) return accountResult;

  if (!accountResult.data?.allowed) {
    return {
      blocked: true,
      retryAfter: retryAfterSeconds(accountResult.data?.retry_after_seconds),
    };
  }

  return { blocked: false };
}

export async function recordLoginFailure(accountKey) {
  return callProtectionRpc("record_login_failure", {
    p_account_key: accountKey,
  });
}

export async function clearLoginFailures(accountKey) {
  return callProtectionRpc("clear_login_failures", {
    p_account_key: accountKey,
  });
}

export function tooManyLoginAttemptsResponse(retryAfter) {
  return Response.json(
    { error: "Too many login attempts. Try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds(retryAfter)) },
    },
  );
}

export function loginProtectionUnavailableResponse() {
  return Response.json(
    { error: "Sign-in is temporarily unavailable. Please try again." },
    { status: 503 },
  );
}
