import { getApiRole } from "../../../../../../lib/auth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../../../lib/request-origin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const subaccountPattern = /^ACCT_[A-Za-z0-9]{5,60}$/;

export async function PATCH(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const auth = await getApiRole(["admin"]);
  if (auth.response) return auth.response;
  if (!isSupabaseAdminConfigured()) {
    return Response.json({ error: "Administrator operations are not configured." }, { status: 503 });
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return Response.json({ error: "Seller not found." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Payout details must contain valid JSON." }, { status: 400 });
  }

  const code = body && typeof body.subaccountCode === "string"
    ? body.subaccountCode.trim()
    : "";
  if (code && !subaccountPattern.test(code)) {
    return Response.json({ error: "Enter a valid Paystack subaccount code." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: seller, error } = await admin
    .from("profiles")
    .update({ paystack_subaccount_code: code || null })
    .eq("id", id)
    .eq("role", "seller")
    .select("id, paystack_subaccount_code")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That Paystack subaccount is already linked to another seller." }, { status: 409 });
    }
    console.error("Unable to update seller payout account", error);
    return Response.json({ error: "We couldn't save that payout account." }, { status: 500 });
  }
  if (!seller) return Response.json({ error: "Seller not found." }, { status: 404 });

  return Response.json({ subaccountCode: seller.paystack_subaccount_code });
}
