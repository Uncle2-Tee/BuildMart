import { NextResponse } from "next/server";
import { confirmOrderPayment, hasPaystackConfig, verifyPaystackTransaction } from "../../../../../lib/paystack";
import { isSupabaseAdminConfigured } from "../../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../../lib/request-origin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function verifyAndConfirm(reference) {
  const transaction = await verifyPaystackTransaction(reference);
  return confirmOrderPayment(reference, transaction);
}

export async function GET(request) {
  const reference = new URL(request.url).searchParams.get("reference");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    return Response.json({ error: "Checkout site URL is not configured." }, { status: 503 });
  }

  if (!hasPaystackConfig() || !isSupabaseAdminConfigured() || !reference || !uuidPattern.test(reference)) {
    return NextResponse.redirect(new URL("/checkout/complete?status=unverified", siteUrl));
  }

  try {
    const confirmation = await verifyAndConfirm(reference);
    if (!confirmation.paid) {
      return NextResponse.redirect(
        new URL(`/checkout/complete?status=failed&reference=${encodeURIComponent(reference)}`, siteUrl),
      );
    }
    return NextResponse.redirect(
      new URL(`/checkout/complete?status=paid&reference=${encodeURIComponent(reference)}`, siteUrl),
    );
  } catch (error) {
    console.error("Paystack return verification failed", error);
    return NextResponse.redirect(
      new URL(`/checkout/complete?status=unverified&reference=${encodeURIComponent(reference)}`, siteUrl),
    );
  }
}

export async function POST(request) {
  if (!hasPaystackConfig() || !isSupabaseAdminConfigured()) {
    return Response.json({ error: "Payment verification is not configured." }, { status: 503 });
  }

  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Payment verification request origin is not allowed." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Payment verification request must contain valid JSON." }, { status: 400 });
  }

  const reference = body?.reference;
  if (typeof reference !== "string" || !uuidPattern.test(reference)) {
    return Response.json({ error: "Payment reference is invalid." }, { status: 400 });
  }

  try {
    const confirmation = await verifyAndConfirm(reference);
    return Response.json({
      paid: confirmation.paid,
      failed: confirmation.failed ?? false,
      orderId: confirmation.orderId,
    });
  } catch (error) {
    console.error("Paystack inline payment verification failed", error);
    return Response.json({ error: "We couldn't confirm the payment yet. Please check your order status shortly." }, { status: 502 });
  }
}
