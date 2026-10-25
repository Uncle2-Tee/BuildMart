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

export async function sendArkeselSms(phone, message) {
  const apiKey = process.env.ARKESEL_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error("ARKESEL_API_KEY is not configured.");
    error.code = "configuration";
    throw error;
  }

  const recipient = formatRecipient(phone);
  if (!recipient) {
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
      recipients: [recipient],
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
      { apiKey, phone, recipient },
    );
    const error = new Error(`Arkesel rejected the SMS (HTTP ${response.status}).`);
    error.code = "provider_rejected";
    error.providerMessage = providerMessage || null;
    throw error;
  }
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

export async function notifyAdminShopBySms(event, message) {
  const phone = process.env.ADMIN_NOTIFICATION_PHONE?.trim();
  if (!phone) {
    console.warn("Admin shop SMS notification skipped because ADMIN_NOTIFICATION_PHONE is not configured.", { event });
    return false;
  }

  return sendArkeselSmsSafely(event, phone, message);
}

export async function notifyNewOrderBySms(admin, { orderId, authorizationUrl, buyerPhone, sellerIds }) {
  if (!hasArkeselConfig()) {
    console.warn("Arkesel order SMS notifications skipped because ARKESEL_API_KEY is not configured.");
    return;
  }

  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const notifications = [
    sendArkeselSmsSafely(
      "buyer-order-placed",
      buyerPhone,
      `BuildMart: Order #${shortOrderId} placed. Complete payment here: ${authorizationUrl}`,
    ),
    ...sellerIds.map(async (sellerId) => {
      let user;
      try {
        const { data, error } = await admin.auth.admin.getUserById(sellerId);
        if (error) throw error;
        user = data.user;
      } catch (error) {
        console.error("Unable to load seller contact for new-order SMS.", {
          sellerId,
          error: error instanceof Error ? error.message : "Unknown Supabase error.",
        });
        return false;
      }

      const phone = user?.user_metadata?.shop_phone;
      if (typeof phone !== "string" || !phone.trim()) {
        console.warn("New-order SMS skipped because seller phone is unavailable.", { sellerId });
        return false;
      }

      return sendArkeselSmsSafely(
        "seller-new-order",
        phone,
        `BuildMart: New order #${shortOrderId} is awaiting payment. Check your seller dashboard for details.`,
      );
    }),
  ];

  await Promise.all(notifications);
}
