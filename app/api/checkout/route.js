import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { hasPaystackConfig } from "../../../lib/paystack";
import { isSameOriginRequest } from "../../../lib/request-origin";
import { notifyNewOrderBySms, notifyOrderPaymentBySms } from "../../../lib/arkesel";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHIPPING_FEE_KOBO = 600;

export async function POST(request) {
  if (!hasPaystackConfig()) {
    return Response.json({ error: "Secure checkout is not configured yet." }, { status: 503 });
  }

  if (!isSupabaseAdminConfigured()) {
    return Response.json({ error: "Order processing is not configured yet." }, { status: 503 });
  }

  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Checkout request origin is not allowed." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Checkout request must contain valid JSON." }, { status: 400 });
  }

  const items = body && body.items;
  const rawDelivery = body?.delivery;

  if (
    !rawDelivery ||
    typeof rawDelivery !== "object" ||
    Array.isArray(rawDelivery) ||
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > 20
  ) {
    return Response.json({ error: "Enter delivery details and select between 1 and 20 products to check out." }, { status: 400 });
  }

  const delivery = {
    name: typeof rawDelivery.name === "string" ? rawDelivery.name.trim() : "",
    phone: typeof rawDelivery.phone === "string" ? rawDelivery.phone.trim() : "",
    region: typeof rawDelivery.region === "string" ? rawDelivery.region.trim() : "",
    city: typeof rawDelivery.city === "string" ? rawDelivery.city.trim() : "",
    address: typeof rawDelivery.address === "string" ? rawDelivery.address.trim() : "",
    digitalAddress: typeof rawDelivery.digitalAddress === "string" ? rawDelivery.digitalAddress.trim() : "",
    instructions: typeof rawDelivery.instructions === "string" ? rawDelivery.instructions.trim() : "",
  };
  const phoneDigits = delivery.phone.replace(/\D/g, "");
  if (
    delivery.name.length < 2 || delivery.name.length > 100 ||
    phoneDigits.length < 7 || phoneDigits.length > 15 || delivery.phone.length > 24 ||
    delivery.region.length < 2 || delivery.region.length > 60 ||
    delivery.city.length < 2 || delivery.city.length > 100 ||
    delivery.address.length < 5 || delivery.address.length > 500 ||
    delivery.digitalAddress.length > 20 ||
    delivery.instructions.length > 500
  ) {
    return Response.json({ error: "Check the recipient name, phone number and delivery address. Optional fields must also be within their character limits." }, { status: 400 });
  }

  let buyerId = null;
  const userClient = await createSupabaseServerClient();
  if (userClient) {
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError && userError.status !== 400 && userError.status !== 401) {
      console.error("Unable to verify optional checkout account", userError);
      return Response.json({ error: "We couldn't verify your account. Please try again." }, { status: 500 });
    }

    if (user && !userError) {
      const { data: profile, error: profileError } = await userClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profileError) {
        console.error("Unable to verify checkout role", profileError);
        return Response.json({ error: "We couldn't verify your account permissions." }, { status: 500 });
      }
      if (profile?.role === "buyer") buyerId = user.id;
    }
  }

  const uniqueIds = new Set();
  for (const item of items) {
    if (
      !item ||
      typeof item.productId !== "string" ||
      !uuidPattern.test(item.productId) ||
      uniqueIds.has(item.productId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      return Response.json({ error: "Your cart contains an invalid product or quantity." }, { status: 400 });
    }
    uniqueIds.add(item.productId);
  }

  const admin = createSupabaseAdminClient();
  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, seller_id, title, price_kobo")
    .eq("active", true)
    .in("id", [...uniqueIds]);

  if (productsError) {
    console.error("Unable to validate checkout products", productsError);
    return Response.json({ error: "We couldn't verify your cart. Please try again." }, { status: 500 });
  }

  if (!products || products.length !== uniqueIds.size) {
    return Response.json({ error: "A product in your cart is no longer available." }, { status: 409 });
  }

  const sellerTotals = new Map();
  for (const product of products) {
    const quantity = items.find((item) => item.productId === product.id).quantity;
    sellerTotals.set(
      product.seller_id,
      (sellerTotals.get(product.seller_id) ?? 0) + product.price_kobo * quantity,
    );
  }

  const sellerIds = [...sellerTotals.keys()];
  const { data: payoutAccounts, error: payoutError } = await admin
    .from("profiles")
    .select("id, role, seller_status")
    .in("id", sellerIds);

  if (payoutError) {
    console.error("Unable to verify seller payout setup", payoutError);
    return Response.json({ error: "We couldn't verify seller payment details." }, { status: 500 });
  }

  const accountBySeller = new Map(
    (payoutAccounts ?? []).map((account) => [account.id, account]),
  );
  if (sellerIds.some((sellerId) => {
    const seller = accountBySeller.get(sellerId);
    return seller?.role !== "seller" || seller.seller_status !== "approved";
  })) {
    return Response.json(
      { error: "A shop in your cart is not currently approved. Please refresh the catalogue." },
      { status: 409 },
    );
  }
  const quantityById = new Map(items.map((item) => [item.productId, item.quantity]));
  const orderItems = products.map((product) => ({
    product_id: product.id,
    seller_id: product.seller_id,
    product_title: product.title,
    unit_price_kobo: product.price_kobo,
    quantity: quantityById.get(product.id),
  }));
  const productSubtotalKobo = products.reduce(
    (sum, product) => sum + product.price_kobo * quantityById.get(product.id),
    0,
  );
  const totalKobo = productSubtotalKobo + SHIPPING_FEE_KOBO;

  if (!Number.isSafeInteger(productSubtotalKobo) || productSubtotalKobo <= 0 || !Number.isSafeInteger(totalKobo)) {
    return Response.json({ error: "The cart total is not valid." }, { status: 400 });
  }

  const orderId = randomUUID();
  const { error: orderError } = await admin.from("orders").insert({
    id: orderId,
    buyer_id: buyerId,
    buyer_email: email,
    delivery_name: delivery.name,
    delivery_phone: delivery.phone,
    delivery_region: delivery.region,
    delivery_city: delivery.city,
    delivery_address: delivery.address,
    delivery_digital_address: delivery.digitalAddress || null,
    delivery_instructions: delivery.instructions || null,
    shipping_fee_kobo: SHIPPING_FEE_KOBO,
    status: "pending",
    total_kobo: totalKobo,
    currency: "GHS",
    payment_reference: orderId,
  });

  if (orderError) {
    console.error("Unable to create checkout order", orderError);
    return Response.json({ error: "We couldn't create your order. Please try again." }, { status: 500 });
  }

  const { error: itemsError } = await admin
    .from("order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: orderId })));

  if (itemsError) {
    console.error("Unable to save checkout items", itemsError);
    const { error: cleanupError } = await admin.from("orders").delete().eq("id", orderId);
    if (cleanupError) console.error("Unable to clean up incomplete checkout order", cleanupError);
    return Response.json({ error: "We couldn't save your order. Please try again." }, { status: 500 });
  }

  let paystackResponse;
  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: totalKobo,
        currency: "GHS",
        reference: orderId,
        channels: ["card", "mobile_money"],
        metadata: { order_id: orderId },
      }),
      cache: "no-store",
    });

    paystackResponse = await response.json();
    if (!response.ok || !paystackResponse.status || !paystackResponse.data?.access_code) {
      throw new Error(paystackResponse.message || "Paystack did not initialize this payment.");
    }
  } catch (error) {
    console.error("Paystack checkout initialization failed", error);
    const { error: updateError } = await admin
      .from("orders")
      .update({ status: "checkout_failed" })
      .eq("id", orderId);
    if (updateError) console.error("Unable to update failed checkout status", updateError);
    await notifyOrderPaymentBySms(admin, {
      orderId,
      buyerPhone: delivery.phone,
      status: "failed",
    });
    return Response.json(
      { error: "Secure checkout could not be opened. Your cart has not been charged; please try again." },
      { status: 502 },
    );
  }

  await notifyNewOrderBySms(admin, {
    orderId,
    buyerPhone: delivery.phone,
    sellerIds,
  });

  return Response.json({ accessCode: paystackResponse.data.access_code, reference: orderId });
}
