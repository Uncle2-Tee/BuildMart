import "server-only";
import { timingSafeEqual, createHmac } from "node:crypto";
import { sendArkeselSmsSafely } from "./arkesel";
import { createSupabaseAdminClient } from "./supabase/admin";

export function hasPaystackConfig() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export async function verifyPaystackTransaction(reference) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      cache: "no-store",
    },
  );
  const result = await response.json();

  if (!response.ok || !result.status || !result.data) {
    throw new Error(result.message || "Paystack could not verify this payment.");
  }

  return result.data;
}

async function requestPaystack(path, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Paystack returned an invalid response (HTTP ${response.status}).`);
  }

  if (!response.ok || !result.status || !result.data) {
    const error = new Error(result.message || `Paystack request failed (HTTP ${response.status}).`);
    if (response.status >= 400 && response.status < 500) error.code = "provider_rejected";
    throw error;
  }
  return result.data;
}

export function createPaystackTransfer({ amount, recipient, reference, reason }) {
  return requestPaystack("/transfer", {
    method: "POST",
    body: { source: "balance", amount, recipient, reference, reason, currency: "GHS" },
  });
}

export function finalizePaystackTransfer({ transferCode, otp }) {
  return requestPaystack("/transfer/finalize_transfer", {
    method: "POST",
    body: { transfer_code: transferCode, otp },
  });
}

export function verifyPaystackTransfer(reference) {
  return requestPaystack(`/transfer/verify/${encodeURIComponent(reference)}`);
}

export async function syncSellerPayoutTransfer(reference, event, transferCode) {
  const transferStatus = event === "transfer.success"
    ? "success"
    : event === "transfer.failed" || event === "transfer.reversed"
      ? "failed"
      : event === "transfer.otp"
        ? "needs_otp"
        : null;
  if (!transferStatus) return false;

  const admin = createSupabaseAdminClient();
  const { data: attempt, error: lookupError } = await admin
    .from("seller_payout_transfers")
    .select("payout_id")
    .eq("reference", reference)
    .maybeSingle();
  if (lookupError) throw new Error(`Unable to find seller transfer: ${lookupError.message}`);
  if (!attempt) return false;

  const { error: transferError } = await admin
    .from("seller_payout_transfers")
    .update({
      status: transferStatus,
      ...(typeof transferCode === "string" ? { transfer_code: transferCode } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("reference", reference);
  if (transferError) throw new Error(`Unable to update seller transfer: ${transferError.message}`);

  const { error: payoutError } = await admin
    .from("seller_payouts")
    .update({
      status: transferStatus === "success" ? "paid" : transferStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attempt.payout_id)
    .eq("active_transfer_reference", reference);
  if (payoutError) throw new Error(`Unable to update seller payout: ${payoutError.message}`);
  return true;
}

export function isValidPaystackSignature(rawBody, signature) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const expected = createHmac("sha512", secret).update(rawBody).digest();
  let provided;

  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function ensureSellerPayouts(admin, orderId) {
  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("seller_id, unit_price_kobo, quantity")
    .eq("order_id", orderId);

  if (itemsError) throw new Error(`Unable to load seller order totals: ${itemsError.message}`);

  const sellerTotals = new Map();
  for (const item of items ?? []) {
    if (!item.seller_id) throw new Error("A paid order item is missing its seller.");
    sellerTotals.set(
      item.seller_id,
      (sellerTotals.get(item.seller_id) ?? 0) + item.unit_price_kobo * item.quantity,
    );
  }

  const payouts = [...sellerTotals.entries()].map(([sellerId, subtotal]) => ({
    seller_id: sellerId,
    order_id: orderId,
    amount_kobo: Math.round((subtotal * 90) / 100),
    currency: "GHS",
  }));
  if (payouts.some((payout) => !Number.isSafeInteger(payout.amount_kobo) || payout.amount_kobo < 1)) {
    throw new Error("A seller payout amount is invalid.");
  }

  if (!payouts.length) throw new Error("The paid order has no seller items.");
  const { error: payoutError } = await admin
    .from("seller_payouts")
    .upsert(payouts, { onConflict: "seller_id,order_id", ignoreDuplicates: true });
  if (payoutError) throw new Error(`Unable to record seller payout obligations: ${payoutError.message}`);
}

export async function confirmOrderPayment(reference, transaction) {
  const admin = createSupabaseAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, status, total_kobo, currency, delivery_phone")
    .eq("payment_reference", reference)
    .single();

  if (orderError) throw new Error(`Unable to find checkout order: ${orderError.message}`);

  if (
    transaction.reference !== reference ||
    transaction.amount !== order.total_kobo ||
    transaction.currency !== order.currency ||
    transaction.currency !== "GHS"
  ) {
    throw new Error("Payment details do not match the checkout order.");
  }

  if (transaction.status !== "success") {
    if (["failed", "abandoned"].includes(transaction.status) && order.status === "pending") {
      const { error: failError } = await admin
        .from("orders")
        .update({ status: "failed" })
        .eq("id", order.id)
        .eq("status", "pending");
      if (failError) throw new Error(`Unable to update failed payment status: ${failError.message}`);
    }
    return { orderId: order.id, paid: false };
  }

  if (order.status === "paid") {
    await ensureSellerPayouts(admin, order.id);
    return { orderId: order.id, paid: true };
  }
  if (order.status !== "pending") {
    throw new Error("This checkout is no longer awaiting payment.");
  }

  const { data: updatedOrder, error: updateError } = await admin
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) throw new Error(`Unable to confirm payment: ${updateError.message}`);

  if (updatedOrder) {
    await ensureSellerPayouts(admin, updatedOrder.id);
    await sendArkeselSmsSafely(
      "buyer-payment-confirmed",
      order.delivery_phone,
      `BuildMart: Payment confirmed for order #${order.id.slice(0, 8).toUpperCase()}. Thank you.`,
    );
    return { orderId: updatedOrder.id, paid: true };
  }

  const { data: latestOrder, error: latestError } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", order.id)
    .single();

  if (latestError) throw new Error(`Unable to confirm order status: ${latestError.message}`);
  if (latestOrder.status === "paid") {
    await ensureSellerPayouts(admin, latestOrder.id);
    return { orderId: latestOrder.id, paid: true };
  }

  throw new Error("This order changed while its payment was being confirmed.");
}
