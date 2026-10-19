import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hashShopApplicationToken, SHOP_APPLICATION_COOKIE } from "../../../lib/shop-application-session";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../lib/request-origin";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  if (!isSupabaseAdminConfigured()) {
    return Response.json({ error: "Shop registration is not configured yet." }, { status: 503 });
  }

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

  const accessToken = randomBytes(32).toString("base64url");
  const admin = createSupabaseAdminClient();
  const { data: application, error } = await admin
    .from("seller_shop_applications")
    .insert({
      shop_name: shopName,
      shop_description: shopDescription,
      shop_location: shopLocation,
      shop_phone: shopPhone,
      access_token_hash: hashShopApplicationToken(accessToken),
    })
    .select("id, status")
    .single();

  if (error) {
    console.error("Unable to save seller shop application", error);
    if (error.code === "PGRST205" || error.code === "42P01") {
      return Response.json(
        { error: "Shop applications are not available yet. The administrator must apply the seller shop applications SQL migration in Supabase." },
        { status: 503 },
      );
    }
    if (error.code === "PGRST204" || error.code === "42703") {
      return Response.json(
        { error: "The shop applications database is out of date. Rerun the seller shop applications SQL migration in Supabase to add its latest columns." },
        { status: 503 },
      );
    }
    return Response.json({ error: "We couldn't submit your shop application. Please try again." }, { status: 500 });
  }

  const response = NextResponse.json({
    shop: {
      name: shopName,
      description: shopDescription,
      location: shopLocation,
      phone: shopPhone,
    },
    applicationId: application.id,
    status: application.status,
  }, { status: 201 });
  response.cookies.set(SHOP_APPLICATION_COOKIE, `${application.id}.${accessToken}`, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
