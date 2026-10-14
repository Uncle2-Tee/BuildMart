import { NextResponse } from "next/server";
import { confirmOrderPayment, hasPaystackConfig, verifyPaystackTransaction } from "../../../../../lib/paystack";
import { isSupabaseAdminConfigured } from "../../../../../lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const transaction = await verifyPaystackTransaction(reference);
    const confirmation = await confirmOrderPayment(reference, transaction);
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
