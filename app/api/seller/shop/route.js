import { getApiRole } from "../../../../lib/auth";
import { notifyAdminShopBySms } from "../../../../lib/arkesel";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../lib/request-origin";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const auth = await getApiRole(["seller"]);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Shop details must contain valid JSON." }, { status: 400 });
  }

  const shopName = typeof body?.shopName === "string" ? body.shopName.trim() : "";
  const shopDescription = typeof body?.shopDescription === "string" ? body.shopDescription.trim() : "";
  const shopLocation = typeof body?.shopLocation === "string" ? body.shopLocation.trim() : "";
  const shopPhone = typeof body?.shopPhone === "string" ? body.shopPhone.trim() : "";

  if (
    shopName.length < 2 ||
    shopName.length > 100 ||
    shopDescription.length < 20 ||
    shopDescription.length > 1000 ||
    shopLocation.length < 2 ||
    shopLocation.length > 120 ||
    !shopPhone ||
    shopPhone.length > 24
  ) {
    return Response.json(
      { error: "Enter a shop name, a description of at least 20 characters, a location, and a phone number." },
      { status: 400 },
    );
  }

  const existingShopName = auth.user.user_metadata?.shop_name;
  const wasApproved = auth.profile.seller_status === "approved";
  if (wasApproved && typeof existingShopName === "string" && existingShopName.trim()) {
    return Response.json(
      { error: "Contact BuildMart support to change details on an approved shop." },
      { status: 409 },
    );
  }

  if (!isSupabaseAdminConfigured()) {
    return Response.json({ error: "Shop registration is not configured yet." }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const { data: updatedProfile, error: statusError } = await admin
    .from("profiles")
    .update({ seller_status: "pending" })
    .eq("id", auth.user.id)
    .eq("role", "seller")
    .select("id")
    .maybeSingle();

  if (statusError) {
    console.error("Unable to queue seller shop for approval", statusError);
    return Response.json({ error: "We couldn't send your shop for review. Please try again." }, { status: 500 });
  }
  if (!updatedProfile) {
    return Response.json({ error: "Seller account not found." }, { status: 404 });
  }

  const { data: updatedUser, error: metadataError } = await auth.supabase.auth.updateUser({
    data: {
      ...auth.user.user_metadata,
      shop_name: shopName,
      shop_description: shopDescription,
      shop_location: shopLocation,
      shop_phone: shopPhone,
    },
  });

  if (metadataError) {
    console.error("Seller shop registration failed", metadataError);
    return Response.json(
      { error: "We couldn't save your shop details. Please try again." },
      { status: 500 },
    );
  }

  await notifyAdminShopBySms(
    "seller-shop-submitted",
    `BuildMart: Seller ${shopName} submitted shop details for approval. Review it in the admin dashboard.`,
  );

  return Response.json({
    shop: {
      name: updatedUser.user.user_metadata.shop_name,
      description: updatedUser.user.user_metadata.shop_description,
      location: updatedUser.user.user_metadata.shop_location,
      phone: updatedUser.user.user_metadata.shop_phone,
    },
    status: "pending",
  });
}
