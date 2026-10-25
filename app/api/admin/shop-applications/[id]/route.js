import { getApiRole } from "../../../../../lib/auth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../../lib/request-origin";
import { notifyAdminShopBySms, sendArkeselSmsWithResult } from "../../../../../lib/arkesel";

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
    return Response.json({ error: "Shop application not found." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Application decision must contain valid JSON." }, { status: 400 });
  }

  if (!body || !["approved", "rejected"].includes(body.status)) {
    return Response.json({ error: "Choose whether to approve or reject this shop application." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existingApplication, error: lookupError } = await admin
    .from("seller_shop_applications")
    .select("id, shop_name, shop_description, shop_location, shop_phone, status, seller_id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("Unable to load seller shop application", lookupError);
    return Response.json({ error: "We couldn't load this shop application." }, { status: 500 });
  }
  if (!existingApplication || existingApplication.status !== "pending") {
    return Response.json({ error: "This pending shop application was not found." }, { status: 404 });
  }

  let sellerId = existingApplication.seller_id;
  if (body.status === "approved" && !sellerId) {
    const { data: createdAccount, error: accountError } = await admin.auth.admin.createUser({
      email: `shop-${id}@accounts.buildmart.invalid`,
      email_confirm: true,
      user_metadata: {
        display_name: existingApplication.shop_name,
        shop_name: existingApplication.shop_name,
        shop_description: existingApplication.shop_description,
        shop_location: existingApplication.shop_location,
        shop_phone: existingApplication.shop_phone,
      },
    });

    if (accountError) {
      console.error("Unable to create internal seller identity for approved shop", accountError);
      return Response.json({ error: "We couldn't prepare this shop for product management." }, { status: 500 });
    }
    sellerId = createdAccount.user.id;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: sellerId,
      display_name: existingApplication.shop_name,
      role: "seller",
      seller_status: "approved",
    });
    if (profileError) {
      console.error("Unable to create approved seller profile", profileError);
      const { error: cleanupError } = await admin.auth.admin.deleteUser(sellerId);
      if (cleanupError) console.error("Unable to clean up incomplete seller identity", cleanupError);
      return Response.json({ error: "We couldn't prepare this shop for product management." }, { status: 500 });
    }
  }

  const { data: application, error } = await admin
    .from("seller_shop_applications")
    .update({
      status: body.status,
      reviewed_at: new Date().toISOString(),
      ...(body.status === "approved" ? { seller_id: sellerId } : {}),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("Unable to update seller shop application", error);
    return Response.json({ error: "We couldn't update this shop application." }, { status: 500 });
  }
  if (!application) {
    return Response.json({ error: "This pending shop application was not found." }, { status: 404 });
  }

  if (body.status === "approved") {
    const { error: profileError } = await admin.from("profiles")
      .update({ seller_status: "approved" })
      .eq("id", sellerId);
    if (profileError) {
      console.error("Unable to activate approved seller profile", profileError);
      return Response.json({ error: "The application was approved, but its seller profile needs administrator attention." }, { status: 500 });
    }
  }

  const sellerNotification = await sendArkeselSmsWithResult(
    `seller-shop-${application.status}`,
    existingApplication.shop_phone,
    application.status === "approved"
      ? `BuildMart: Your shop ${existingApplication.shop_name} has been approved. You can now manage it from your seller dashboard.`
      : `BuildMart: Your shop ${existingApplication.shop_name} was not approved. Contact BuildMart support if you have questions.`,
  );

  await notifyAdminShopBySms(
    `shop-application-${application.status}`,
    `BuildMart: Shop application ${existingApplication.shop_name} was ${application.status} by an admin.`,
  );

  return Response.json({ status: application.status, sellerNotification });
}
