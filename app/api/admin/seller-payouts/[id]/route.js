import { randomUUID } from "node:crypto";
import { getApiRole } from "../../../../../lib/auth";
import {
  createPaystackTransfer,
  finalizePaystackTransfer,
  hasPaystackConfig,
  verifyPaystackTransfer,
} from "../../../../../lib/paystack";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../../lib/request-origin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getTransferStatus(status) {
  switch (typeof status === "string" ? status.toLowerCase() : "") {
    case "success":
      return "success";
    case "failed":
    case "reversed":
      return "failed";
    case "otp":
      return "needs_otp";
    case "pending":
    default:
      return "processing";
  }
}

async function saveTransferResult(admin, payout, reference, transfer) {
  const requestedStatus = getTransferStatus(transfer.status);
  const timestamp = new Date().toISOString();
  const updatableStatuses = requestedStatus === "processing"
    ? ["processing"]
    : ["processing", "needs_otp", "review"];
  const { data: updatedAttempt, error: transferError } = await admin
    .from("seller_payout_transfers")
    .update({
      status: requestedStatus,
      transfer_code: transfer.transfer_code ?? null,
      updated_at: timestamp,
    })
    .eq("reference", reference)
    .in("status", updatableStatuses)
    .select("status")
    .maybeSingle();
  if (transferError) throw new Error(`Unable to save Paystack transfer result: ${transferError.message}`);

  let attempt = updatedAttempt;
  if (!attempt) {
    const { data, error } = await admin
      .from("seller_payout_transfers")
      .select("status")
      .eq("reference", reference)
      .maybeSingle();
    if (error) throw new Error(`Unable to reload Paystack transfer result: ${error.message}`);
    attempt = data;
  }
  if (!attempt) throw new Error("Unable to reload Paystack transfer result.");

  const finalStatus = attempt.status;
  const payoutStatus = finalStatus === "success" ? "paid" : finalStatus;
  const { error: payoutError } = await admin
    .from("seller_payouts")
    .update({
      status: payoutStatus,
      updated_at: timestamp,
    })
    .eq("id", payout.id)
    .eq("active_transfer_reference", reference)
    .in("status", ["processing", "needs_otp", "review"]);
  if (payoutError) throw new Error(`Unable to save seller payout status: ${payoutError.message}`);
  return finalStatus === "success" ? "paid" : finalStatus;
}

export async function POST(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const auth = await getApiRole(["admin"]);
  if (auth.response) return auth.response;
  if (!hasPaystackConfig() || !isSupabaseAdminConfigured()) {
    return Response.json({ error: "Seller payouts are not configured." }, { status: 503 });
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return Response.json({ error: "Seller payout not found." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Payout request must contain valid JSON." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: payout, error: payoutError } = await admin
    .from("seller_payouts")
    .select("id, seller_id, order_id, amount_kobo, currency, status, active_transfer_reference")
    .eq("id", id)
    .maybeSingle();
  if (payoutError) {
    console.error("Unable to load seller payout", payoutError);
    return Response.json({ error: "We couldn't load this seller payout." }, { status: 500 });
  }
  if (!payout) return Response.json({ error: "Seller payout not found." }, { status: 404 });

  if (body?.action === "send") {
    if (!["pending", "failed"].includes(payout.status)) {
      return Response.json({ error: "This payout is not ready to send or retry." }, { status: 409 });
    }

    const { data: seller, error: sellerError } = await admin
      .from("profiles")
      .select("id, role, paystack_recipient_code")
      .eq("id", payout.seller_id)
      .maybeSingle();
    if (sellerError) {
      console.error("Unable to load seller transfer recipient", sellerError);
      return Response.json({ error: "We couldn't verify the seller's transfer recipient." }, { status: 500 });
    }
    if (seller?.role !== "seller" || !seller.paystack_recipient_code) {
      return Response.json({ error: "Save a verified Paystack transfer recipient for this seller first." }, { status: 409 });
    }
    const amount = Number(payout.amount_kobo);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      return Response.json({ error: "This seller payout amount is invalid and cannot be sent." }, { status: 409 });
    }

    const reference = randomUUID();
    const { data: attempt, error: attemptError } = await admin
      .from("seller_payout_transfers")
      .insert({ payout_id: payout.id, reference, status: "processing" })
      .select("id")
      .single();
    if (attemptError) {
      console.error("Unable to create seller transfer attempt", attemptError);
      return Response.json({ error: "We couldn't prepare this seller transfer." }, { status: 500 });
    }

    const { data: claimedPayout, error: claimError } = await admin
      .from("seller_payouts")
      .update({
        status: "processing",
        active_transfer_reference: reference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id)
      .eq("status", payout.status)
      .select("id")
      .maybeSingle();

    if (claimError || !claimedPayout) {
      const { error: cancelError } = await admin
        .from("seller_payout_transfers")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", attempt.id);
      if (cancelError) console.error("Unable to cancel unclaimed seller transfer attempt", cancelError);
      if (claimError) {
        console.error("Unable to claim seller payout", claimError);
        return Response.json({ error: "We couldn't reserve this seller payout." }, { status: 500 });
      }
      return Response.json({ error: "This seller payout was already updated. Refresh and try again." }, { status: 409 });
    }

    let transfer;
    try {
      transfer = await createPaystackTransfer({
        amount,
        recipient: seller.paystack_recipient_code,
        reference,
        reason: `BuildMart seller payout for order ${payout.order_id}`,
      });
    } catch (error) {
      const transferStatus = error?.code === "provider_rejected" ? "failed" : "review";
      console.error("Paystack seller transfer could not be confirmed; manual verification is required.", {
        payoutId: payout.id,
        reference,
        code: error?.code ?? "network_error",
        error: error instanceof Error ? error.message : "Unknown Paystack error.",
      });
      const { error: reviewError } = await admin
        .from("seller_payout_transfers")
        .update({
          status: transferStatus,
          provider_message: transferStatus === "review"
            ? "Provider result is uncertain. Verify this reference in Paystack before retrying."
            : "Paystack rejected the transfer request.",
          updated_at: new Date().toISOString(),
        })
        .eq("reference", reference)
        .eq("status", "processing");
      if (reviewError) console.error("Unable to flag uncertain seller transfer for review", reviewError);
      const { error: payoutReviewError } = await admin
        .from("seller_payouts")
        .update({ status: transferStatus, updated_at: new Date().toISOString() })
        .eq("id", payout.id)
        .eq("active_transfer_reference", reference)
        .eq("status", "processing");
      if (payoutReviewError) console.error("Unable to flag seller payout for manual review", payoutReviewError);
      return Response.json(
        {
          error: transferStatus === "review"
            ? "Paystack did not confirm this transfer. Check its reference in Paystack before retrying."
            : "Paystack rejected this transfer. Check the recipient and Paystack balance before retrying.",
          status: transferStatus,
          reference,
        },
        { status: 502 },
      );
    }

    try {
      const status = await saveTransferResult(admin, payout, reference, transfer);
      return Response.json({ status, reference });
    } catch (error) {
      console.error("Unable to persist Paystack seller transfer result", {
        payoutId: payout.id,
        reference,
        error: error instanceof Error ? error.message : "Unknown database error.",
      });
      return Response.json(
        {
          error: "Paystack received the transfer request, but its status could not be saved. Check the payout dashboard before retrying.",
          status: "review",
          reference,
        },
        { status: 502 },
      );
    }
  }

  if (body?.action === "finalize") {
    if (payout.status !== "needs_otp" || !payout.active_transfer_reference) {
      return Response.json({ error: "This payout is not awaiting transfer confirmation." }, { status: 409 });
    }
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";
    if (!/^\d{4,8}$/.test(otp)) {
      return Response.json({ error: "Enter the transfer confirmation code from Paystack." }, { status: 400 });
    }

    const { data: attempt, error: attemptError } = await admin
      .from("seller_payout_transfers")
      .select("transfer_code")
      .eq("reference", payout.active_transfer_reference)
      .maybeSingle();
    if (attemptError) {
      console.error("Unable to load seller transfer confirmation", attemptError);
      return Response.json({ error: "We couldn't load the transfer confirmation." }, { status: 500 });
    }
    if (!attempt?.transfer_code) {
      return Response.json({ error: "Paystack has not provided a transfer code for this payout." }, { status: 409 });
    }

    try {
      const transfer = await finalizePaystackTransfer({ transferCode: attempt.transfer_code, otp });
      const status = await saveTransferResult(admin, payout, payout.active_transfer_reference, transfer);
      return Response.json({ status, reference: payout.active_transfer_reference });
    } catch (error) {
      console.error("Unable to finalize Paystack seller transfer", {
        payoutId: payout.id,
        reference: payout.active_transfer_reference,
        error: error instanceof Error ? error.message : "Unknown Paystack error.",
      });
      return Response.json({
        error: "Paystack could not confirm this transfer. Check its status before retrying.",
        reference: payout.active_transfer_reference,
      }, { status: 502 });
    }
  }

  if (body?.action === "verify") {
    if (!payout.active_transfer_reference || !["processing", "needs_otp", "review"].includes(payout.status)) {
      return Response.json({ error: "This payout has no transfer that needs verification." }, { status: 409 });
    }
    try {
      const transfer = await verifyPaystackTransfer(payout.active_transfer_reference);
      const status = await saveTransferResult(admin, payout, payout.active_transfer_reference, transfer);
      return Response.json({ status, reference: payout.active_transfer_reference });
    } catch (error) {
      console.error("Unable to verify Paystack seller transfer", {
        payoutId: payout.id,
        reference: payout.active_transfer_reference,
        error: error instanceof Error ? error.message : "Unknown Paystack error.",
      });
      return Response.json({
        error: "Paystack could not verify this transfer. Check its status in Paystack.",
        reference: payout.active_transfer_reference,
      }, { status: 502 });
    }
  }

  return Response.json({ error: "Choose a valid payout action." }, { status: 400 });
}
