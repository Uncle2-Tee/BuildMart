import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "./supabase/admin";

export const SHOP_APPLICATION_COOKIE = "buildmart_shop_application";

export function hashShopApplicationToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function matchesHash(token, expectedHash) {
  if (typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashShopApplicationToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return timingSafeEqual(actual, expected);
}

export async function getShopApplicationSession({ requireApproved = false } = {}) {
  if (!isSupabaseAdminConfigured()) return null;

  const cookie = (await cookies()).get(SHOP_APPLICATION_COOKIE)?.value ?? "";
  const separator = cookie.indexOf(".");
  if (separator < 1) return null;

  const applicationId = cookie.slice(0, separator);
  const token = cookie.slice(separator + 1);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId) ||
      !/^[A-Za-z0-9_-]{40,}$/.test(token)) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: application, error } = await admin
    .from("seller_shop_applications")
    .select("id, shop_name, shop_description, shop_location, shop_phone, status, seller_id, access_token_hash")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    console.error("Unable to verify shop application access", error);
    throw new Error("Unable to verify shop application access.");
  }
  if (!application || !matchesHash(token, application.access_token_hash)) return null;
  if (requireApproved && (application.status !== "approved" || !application.seller_id)) return null;

  return { admin, application };
}
