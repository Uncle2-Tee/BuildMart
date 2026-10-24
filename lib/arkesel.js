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

export async function sendArkeselSms(phone, message) {
  const apiKey = process.env.ARKESEL_API_KEY?.trim();
  if (!apiKey) throw new Error("ARKESEL_API_KEY is not configured.");

  const recipient = formatRecipient(phone);
  if (!recipient) throw new Error("The recipient phone number is not a valid Ghana or international number.");

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

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Arkesel returned an invalid response (HTTP ${response.status}).`);
  }

  const resultStatus = typeof result?.status === "string" ? result.status.toLowerCase() : result?.status;
  if (!response.ok || resultStatus === false || ["error", "failed", "failure"].includes(resultStatus)) {
    throw new Error(`Arkesel rejected the SMS (HTTP ${response.status}).`);
  }
}

export async function sendArkeselSmsSafely(event, phone, message) {
  if (!hasArkeselConfig()) {
    console.warn("Arkesel SMS skipped because ARKESEL_API_KEY is not configured.", { event });
    return false;
  }

  try {
    await sendArkeselSms(phone, message);
    return true;
  } catch (error) {
    console.error("Arkesel SMS notification failed.", {
      event,
      error: error instanceof Error ? error.message : "Unknown Arkesel error.",
    });
    return false;
  }
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
