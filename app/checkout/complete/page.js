import Link from "next/link";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../lib/supabase/admin";
import { isSupabaseConfigured } from "../../../lib/supabase/server";
import { hasPaystackConfig } from "../../../lib/paystack";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata = {
  title: "Checkout status | BuildMart Ghana",
};

export default async function CheckoutCompletePage({ searchParams }) {
  const params = await searchParams;
  const reference = params.reference;
  let paid = false;

  if (
    params.status === "paid" &&
    typeof reference === "string" &&
    uuidPattern.test(reference) &&
    isSupabaseConfigured() &&
    isSupabaseAdminConfigured() &&
    hasPaystackConfig()
  ) {
    const admin = createSupabaseAdminClient();
    const { data: order, error } = await admin
      .from("orders")
      .select("status")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (error) {
      console.error("Unable to load checkout confirmation", error);
    } else {
      paid = order?.status === "paid";
    }
  }

  return (
    <main className="checkout-result">
      <span className="result-mark">{paid ? "✓" : params.status === "failed" ? "×" : "…"}</span>
      <span className="eyebrow muted-eyebrow">{paid ? "PAYMENT CONFIRMED" : params.status === "failed" ? "PAYMENT NOT COMPLETED" : "PAYMENT STATUS"}</span>
      <h1>{paid ? <>Thank you for<br /><em>building with us.</em></> : params.status === "failed" ? <>No charge was<br /><em>completed.</em></> : <>We&apos;re checking<br /><em>your payment.</em></>}</h1>
      <p>{paid ? "Your payment was confirmed securely." : params.status === "failed" ? "The payment was not completed. Your order was not charged; you can return to the marketplace and try again." : "Your order is not marked as paid yet. If you completed payment, give us a moment and refresh this page."}</p>
      <Link className="button button-dark" href="/">Back to BuildMart <span aria-hidden="true">↗</span></Link>
      {!paid && reference ? <p className="reference-note">Keep this payment reference: {reference.slice(0, 8).toUpperCase()}</p> : null}
    </main>
  );
}
