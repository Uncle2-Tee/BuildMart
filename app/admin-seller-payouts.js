"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function formatPayout(amountKobo) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(amountKobo / 100);
}

const payoutStatusLabels = {
  pending: "Ready to pay",
  processing: "Transfer processing",
  needs_otp: "Confirmation required",
  paid: "Paid",
  failed: "Transfer failed",
  review: "Manual review required",
};

export default function AdminSellerPayouts({ sellerId, initialPayouts, hasRecipient }) {
  const router = useRouter();
  const [payouts, setPayouts] = useState(initialPayouts);
  const [otpByPayout, setOtpByPayout] = useState({});
  const [busyPayoutId, setBusyPayoutId] = useState("");
  const [message, setMessage] = useState("");

  async function runPayoutAction(payout, action) {
    setBusyPayoutId(payout.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/seller-payouts/${payout.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "finalize" ? { otp: otpByPayout[payout.id] ?? "" } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Could not update this seller payout.");
        if (result.status) {
          setPayouts((current) => current.map((item) => (
            item.id === payout.id
              ? {
                ...item,
                status: result.status,
                active_transfer_reference: result.reference ?? item.active_transfer_reference,
              }
              : item
          )));
        }
        return;
      }

      setPayouts((current) => current.map((item) => (
        item.id === payout.id
          ? {
            ...item,
            status: result.status,
            active_transfer_reference: result.reference ?? item.active_transfer_reference,
          }
          : item
      )));
      setOtpByPayout((current) => ({ ...current, [payout.id]: "" }));
      setMessage(
        result.status === "paid"
          ? "Paystack confirmed the seller transfer."
          : result.status === "needs_otp"
            ? "Enter the transfer confirmation code from Paystack."
            : result.status === "failed"
              ? "Paystack reports that the transfer failed."
              : "Transfer status updated. Refresh to see the latest payout state.",
      );
      router.refresh();
    } catch {
      setMessage("We couldn't connect to the payout service. Check Paystack before retrying.");
    } finally {
      setBusyPayoutId("");
    }
  }

  if (!payouts.length) return null;

  return (
    <section className="seller-payouts" aria-label={`Seller payouts ${sellerId}`}>
      <h3>Seller payouts</h3>
      {message ? <p className="payout-message" role="status">{message}</p> : null}
      <ul>
        {payouts.map((payout) => (
          <li key={payout.id}>
            <span>
              <strong>{formatPayout(payout.amount_kobo)}</strong>
              <small>Order #{payout.order_id.slice(0, 8).toUpperCase()} · {payoutStatusLabels[payout.status] ?? payout.status}</small>
              {payout.status === "review" && payout.active_transfer_reference ? (
                <small>Paystack reference: {payout.active_transfer_reference}</small>
              ) : null}
            </span>
            {payout.status === "needs_otp" ? (
              <form
                className="seller-payout-otp"
                onSubmit={(event) => {
                  event.preventDefault();
                  runPayoutAction(payout, "finalize");
                }}
              >
                <label>
                  Transfer confirmation code
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={8}
                    value={otpByPayout[payout.id] ?? ""}
                    onChange={(event) => setOtpByPayout((current) => ({
                      ...current,
                      [payout.id]: event.target.value.replace(/\D/g, ""),
                    }))}
                  />
                </label>
                <button className="small-action" type="submit" disabled={busyPayoutId === payout.id}>
                  {busyPayoutId === payout.id ? "Confirming…" : "Confirm transfer"}
                </button>
              </form>
            ) : null}
            {["pending", "failed"].includes(payout.status) ? (
              <button
                className="small-action"
                type="button"
                disabled={busyPayoutId === payout.id || !hasRecipient}
                onClick={() => runPayoutAction(payout, "send")}
              >
                {busyPayoutId === payout.id ? "Sending…" : payout.status === "failed" ? "Retry transfer" : "Pay seller"}
              </button>
            ) : null}
            {["processing", "needs_otp", "review"].includes(payout.status) ? (
              <button
                className="small-action"
                type="button"
                disabled={busyPayoutId === payout.id}
                onClick={() => runPayoutAction(payout, "verify")}
              >
                {busyPayoutId === payout.id ? "Checking…" : "Check transfer"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!hasRecipient ? <small>Save a verified Paystack transfer recipient code to enable payouts.</small> : null}
    </section>
  );
}
