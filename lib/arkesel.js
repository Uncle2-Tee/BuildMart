import "server-only";

const ARKESEL_SMS_URL = "https://sms.arkesel.com/api/v2/sms/send";

export function hasArkeselConfig() {
  return Boolean(process.env.ARKESEL_API_KEY?.trim());
}

function formatRecipient(phone) {
  if (typeof phone !== "string") return null;

  const digits = phone.replace(/\D/g, "");
  if (/^233\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `233${digits}`;
  if (phone.trim().startsWith("+") && /^\d{10,15}$/.test(digits)) return digits;
  return null;
}

function formatRecipients(phones) {
  const recipients = new Set();
  let invalidCount = 0;
  for (const phone of phones) {
    const recipient = formatRecipient(phone);
    if (recipient) recipients.add(recipient);
    else invalidCount += 1;
  }
  return { recipients: [...recipients], invalidCount };
}

function getProviderMessage(result) {
  for (const value of [result?.message, result?.error, result?.detail, result?.description]) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && typeof value.message === "string") {
      return value.message.trim();
    }
  }
  return null;
}

function sanitizeProviderMessage(message, { apiKey, phone, recipient }) {
  let sanitized = message;
  for (const sensitiveValue of [apiKey, phone, recipient]) {
    if (typeof sensitiveValue === "string" && sensitiveValue) {
      sanitized = sanitized.replaceAll(sensitiveValue, "[redacted]");
    }
  }
  return sanitized.replace(/\s+/g, " ").trim().slice(0, 240);
}

function getProviderRejectionReason(providerMessage) {
  const message = providerMessage?.toLowerCase() ?? "";
  if (/sender|brand|sender.?id/.test(message)) {
    return "Arkesel rejected the sender ID. Set ARKESEL_SENDER_ID to a sender ID approved for your Arkesel account.";
  }
  if (/balance|credit|wallet|fund/.test(message)) {
    return "The Arkesel account may not have enough SMS credit. Check its balance.";
  }
  if (/api.?key|auth|token|unauthori[sz]ed|credential/.test(message)) {
    return "Arkesel rejected the API credentials. Verify the server's ARKESEL_API_KEY.";
  }
  if (/recipient|phone|mobile|number/.test(message)) {
    return "Arkesel rejected the recipient number. Verify the seller's registered phone number and country code.";
  }
  return "Arkesel rejected the SMS. Check the provider response in the server logs.";
}

async function sendArkeselSmsToRecipients(recipients, message, phoneValues = []) {
  const apiKey = process.env.ARKESEL_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error("ARKESEL_API_KEY is not configured.");
    error.code = "configuration";
    throw error;
  }

  if (!recipients.length) {
    const error = new Error("The recipient phone number is not a valid Ghana or international number.");
    error.code = "invalid_recipient";
    throw error;
  }

  const response = await fetch(ARKESEL_SMS_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: process.env.ARKESEL_SENDER_ID?.trim() || "BuildMart",
      message,
      recipients,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  const responseText = await response.text();
  let result = null;
  try {
    result = JSON.parse(responseText);
  } catch {
    const error = new Error(`Arkesel returned an invalid response (HTTP ${response.status}).`);
    error.code = "invalid_response";
    throw error;
  }

  const resultStatus = typeof result?.status === "string" ? result.status.toLowerCase() : result?.status;
  if (
    !response.ok ||
    resultStatus === false ||
    ["error", "failed", "failure", "rejected"].includes(resultStatus)
  ) {
    const providerMessage = sanitizeProviderMessage(
      getProviderMessage(result) ?? "",
      { apiKey, phone: phoneValues.join(","), recipient: recipients.join(",") },
    );
    const error = new Error(`Arkesel rejected the SMS (HTTP ${response.status}).`);
    error.code = "provider_rejected";
    error.providerMessage = providerMessage || null;
    throw error;
  }
}

export async function sendArkeselSms(phone, message) {
  const recipient = formatRecipient(phone);
  if (!recipient) {
    const error = new Error("The recipient phone number is not a valid Ghana or international number.");
    error.code = "invalid_recipient";
    throw error;
  }
  await sendArkeselSmsToRecipients([recipient], message, [phone]);
}

function getSmsFailureReason(error) {
  switch (error?.code) {
    case "configuration":
      return "The SMS API key is missing from the server configuration.";
    case "invalid_recipient":
      return "The seller's phone number is not in a supported format.";
    case "provider_rejected":
      return getProviderRejectionReason(error.providerMessage);
    case "invalid_response":
      return "Arkesel returned an invalid response. Check the server logs.";
    default:
      if (error?.name === "TimeoutError") return "The request to Arkesel timed out.";
      return "Could not connect to Arkesel. Check the server logs and network connection.";
  }
}

export async function sendArkeselSmsWithResult(event, phone, message) {
  if (!hasArkeselConfig()) {
    console.warn("Arkesel SMS skipped because ARKESEL_API_KEY is not configured.", { event });
    return {
      sent: false,
      reason: "The SMS API key is missing from the server configuration.",
    };
  }

  try {
    await sendArkeselSms(phone, message);
    return { sent: true, reason: null };
  } catch (error) {
    console.error("Arkesel SMS notification failed.", {
      event,
      code: error?.code ?? (error?.name === "TimeoutError" ? "timeout" : "network_error"),
      providerMessage: error?.providerMessage ?? undefined,
      error: error instanceof Error ? error.message : "Unknown Arkesel error.",
    });
    return { sent: false, reason: getSmsFailureReason(error) };
  }
}

export async function sendArkeselSmsSafely(event, phone, message) {
  const result = await sendArkeselSmsWithResult(event, phone, message);
  return result.sent;
}

async function sendArkeselSmsToManySafely(event, phones, message) {
  const { recipients, invalidCount } = formatRecipients(phones);
  if (invalidCount) {
    console.warn("Some seller order SMS notifications were skipped because phone numbers are invalid.", {
      event,
      invalidCount,
    });
  }
  if (!recipients.length) {
    console.warn("Seller order SMS skipped because no valid seller phone numbers were available.", { event });
    return false;
  }
  if (!hasArkeselConfig()) {
    console.warn("Arkesel SMS skipped because ARKESEL_API_KEY is not configured.", {
      event,
      recipientCount: recipients.length,
    });
    return false;
  }

  try {
    await sendArkeselSmsToRecipients(recipients, message, phones);
    return true;
  } catch (error) {
    console.error("Arkesel SMS notification failed.", {
      event,
      recipientCount: recipients.length,
      code: error?.code ?? (error?.name === "TimeoutError" ? "timeout" : "network_error"),
      providerMessage: error?.providerMessage ?? undefined,
      error: error instanceof Error ? error.message : "Unknown Arkesel error.",
    });
    return false;
  }
}

export async function notifyAdminBySms(event, message) {
  const phone = process.env.ADMIN_NOTIFICATION_PHONE?.trim();
  if (!phone) {
    console.warn("Admin SMS notification skipped because ADMIN_NOTIFICATION_PHONE is not configured.", { event });
    return false;
  }

  return sendArkeselSmsSafely(event, phone, message);
}

export async function notifyNewOrderBySms(admin, { orderId, buyerPhone, sellerIds }) {
  if (!hasArkeselConfig()) {
    console.warn("Arkesel order SMS notifications skipped because ARKESEL_API_KEY is not configured.");
    return;
  }

  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const uniqueSellerIds = [...new Set(sellerIds.filter((sellerId) => typeof sellerId === "string" && sellerId))];
  const notifications = [
    sendArkeselSmsSafely(
      "buyer-order-placed",
      buyerPhone,
      `BuildMart: Order #${shortOrderId} placed. Complete payment in your open BuildMart checkout.`,
    ),
    (async () => {
      const phones = [];
      let nextSellerIndex = 0;
      const workerCount = Math.min(5, uniqueSellerIds.length);
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextSellerIndex < uniqueSellerIds.length) {
          const sellerId = uniqueSellerIds[nextSellerIndex];
          nextSellerIndex += 1;
          try {
            const { data, error } = await admin.auth.admin.getUserById(sellerId);
            if (error) throw error;
            const phone = data.user?.user_metadata?.shop_phone;
            if (typeof phone !== "string" || !phone.trim()) {
              console.warn("New-order SMS skipped because seller phone is unavailable.", { sellerId, orderId });
              continue;
            }
            phones.push(phone);
          } catch (error) {
            console.error("Unable to load seller contact for new-order SMS.", {
              sellerId,
              orderId,
              error: error instanceof Error ? error.message : "Unknown Supabase error.",
            });
          }
        }
      }));

      return sendArkeselSmsToManySafely(
        "seller-new-order",
        phones,
        `BuildMart: New order #${shortOrderId} includes items from your shop. Payment is pending; check your seller dashboard before preparing it.`,
      );
    })(),
  ];

  await Promise.all(notifications);
}

export async function notifyOrderPaymentBySms(admin, { orderId, buyerPhone, status }) {
  if (!["paid", "failed"].includes(status)) {
    throw new Error(`Unsupported order payment notification status: ${status}`);
  }
  if (!hasArkeselConfig()) {
    console.warn("Arkesel payment SMS notifications skipped because ARKESEL_API_KEY is not configured.", {
      orderId,
      status,
    });
    return;
  }

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("seller_id")
    .eq("order_id", orderId);
  if (itemsError) {
    console.error("Unable to load seller recipients for payment SMS.", {
      orderId,
      error: itemsError.message,
    });
  }

  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const paid = status === "paid";
  const notifications = [
    sendArkeselSmsSafely(
      `buyer-payment-${status}`,
      buyerPhone,
      paid
        ? `BuildMart: Payment confirmed for order #${shortOrderId}. Thank you.`
        : `BuildMart: Payment for order #${shortOrderId} was not completed. Your order has not been charged.`,
    ),
    notifyAdminBySms(
      `order-payment-${status}`,
      `BuildMart: Order #${shortOrderId} payment was ${paid ? "confirmed" : "not completed"}.`,
    ),
  ];

  const sellerIds = [...new Set((items ?? []).map((item) => item.seller_id).filter(Boolean))];
  for (const sellerId of sellerIds) {
    notifications.push((async () => {
      let user;
      try {
        const { data, error } = await admin.auth.admin.getUserById(sellerId);
        if (error) throw error;
        user = data.user;
      } catch (error) {
        console.error("Unable to load seller contact for payment SMS.", {
          sellerId,
          orderId,
          error: error instanceof Error ? error.message : "Unknown Supabase error.",
        });
        return false;
      }

      const phone = user?.user_metadata?.shop_phone;
      if (typeof phone !== "string" || !phone.trim()) {
        console.warn("Order payment SMS skipped because seller phone is unavailable.", { sellerId, orderId });
        return false;
      }

      return sendArkeselSmsSafely(
        `seller-order-payment-${status}`,
        phone,
        paid
          ? `BuildMart: Payment for order #${shortOrderId} is confirmed. You can prepare your items.`
          : `BuildMart: Payment for order #${shortOrderId} was not completed. Do not prepare this order yet.`,
      );
    })());
  }

  await Promise.all(notifications);
}
