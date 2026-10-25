import { getApiRole } from "../../../../../../lib/auth";
import { invalidateApprovedProductCatalog } from "../../../../../../lib/buyer-dashboard-data";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../../../lib/request-origin";
import { notifyAdminShopBySms, sendArkeselSmsWithResult } from "../../../../../../lib/arkesel";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    return Response.json({ error: "Approval details must contain valid JSON." }, { status: 400 });
  }

  if (!body || !["approved", "rejected"].includes(body.status)) {
    return Response.json({ error: "Choose whether to approve or reject this shop." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(id);
  if (authUserError) {
    console.error("Unable to verify seller shop registration", authUserError);
    return Response.json({ error: "We couldn't verify this seller's shop registration." }, { status: 500 });
  }
  if (typeof authUser.user?.user_metadata?.shop_name !== "string" || !authUser.user.user_metadata.shop_name.trim()) {
    return Response.json({ error: "The seller must register a shop before it can be reviewed." }, { status: 409 });
  }

  const { data: currentSeller, error: currentSellerError } = await admin
    .from("profiles")
    .select("seller_status")
    .eq("id", id)
    .eq("role", "seller")
    .maybeSingle();

  if (currentSellerError) {
    console.error("Unable to load seller shop approval status", currentSellerError);
    return Response.json({ error: "We couldn't verify this seller's current shop status." }, { status: 500 });
  }
  if (!currentSeller) return Response.json({ error: "Seller not found." }, { status: 404 });

  const { data: seller, error } = await admin
    .from("profiles")
    .update({ seller_status: body.status })
    .eq("id", id)
    .eq("role", "seller")
    .select("id, seller_status")
    .maybeSingle();

  if (error) {
    console.error("Unable to update seller shop approval", error);
    return Response.json({ error: "We couldn't update this shop's approval." }, { status: 500 });
  }
  if (!seller) return Response.json({ error: "Seller not found." }, { status: 404 });

  let sellerNotification = null;
  if (seller.seller_status !== currentSeller.seller_status) {
    const shopName = authUser.user.user_metadata.shop_name.trim();
    const phone = authUser.user.user_metadata.shop_phone;
    sellerNotification = await sendArkeselSmsWithResult(
      `seller-shop-${seller.seller_status}`,
      phone,
      seller.seller_status === "approved"
        ? `BuildMart: Your shop ${shopName} has been approved. You can now manage it from your seller dashboard.`
        : `BuildMart: Your shop ${shopName} was not approved. Contact BuildMart support if you have questions.`,
    );
  }

  if (seller.seller_status !== currentSeller.seller_status) {
    const shopName = authUser.user.user_metadata.shop_name.trim();
    await notifyAdminShopBySms(
      `seller-shop-${seller.seller_status}`,
      `BuildMart: Shop ${shopName} was ${seller.seller_status} by an admin.`,
    );
  }

  invalidateApprovedProductCatalog();
  return Response.json({ status: seller.seller_status, sellerNotification });
}
