import {
  confirmOrderPayment,
  hasPaystackConfig,
  isValidPaystackSignature,
  verifyPaystackTransaction,
} from "../../../../../lib/paystack";
import { isSupabaseAdminConfigured } from "../../../../../lib/supabase/admin";

export async function POST(request) {
  if (!hasPaystackConfig() || !isSupabaseAdminConfigured()) {
    return Response.json({ error: "Payment verification is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!isValidPaystackSignature(rawBody, signature)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Webhook body is not valid JSON." }, { status: 400 });
  }

  if (event.event !== "charge.success") {
    return Response.json({ received: true });
  }

  const reference = event.data?.reference;
  if (typeof reference !== "string") {
    return Response.json({ error: "Webhook is missing its payment reference." }, { status: 400 });
  }

  try {
    const transaction = await verifyPaystackTransaction(reference);
    const confirmation = await confirmOrderPayment(reference, transaction);
    if (!confirmation.paid) {
      return Response.json({ error: "Verified transaction has not completed payment." }, { status: 409 });
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook payment verification failed", error);
    return Response.json({ error: "Payment verification failed." }, { status: 500 });
  }
}
