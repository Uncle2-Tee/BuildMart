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

  if (order.status === "paid") return { orderId: order.id, paid: true };
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
  if (latestOrder.status === "paid") return { orderId: latestOrder.id, paid: true };

  throw new Error("This order changed while its payment was being confirmed.");
}
