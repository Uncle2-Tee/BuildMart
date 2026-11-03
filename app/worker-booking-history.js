"use client";

import { useEffect, useState } from "react";

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatBudget(value) {
  if (!value) return "Budget not specified";
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(value / 100);
}

export default function WorkerBookingHistory({ bookings }) {
  const [bookingStatuses, setBookingStatuses] = useState(() => Object.fromEntries(bookings.map((booking) => [booking.id, booking.status])));
  const [busyBookingId, setBusyBookingId] = useState("");
  const [messages, setMessages] = useState({});

  useEffect(() => {
    setBookingStatuses(Object.fromEntries(bookings.map((booking) => [booking.id, booking.status])));
  }, [bookings]);

  async function respondToBooking(booking, status) {
    if (busyBookingId) return;
    setBusyBookingId(booking.id);
    setMessages((current) => ({ ...current, [booking.id]: "" }));

    try {
      const response = await fetch(`/api/worker/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not update this booking.");

      setBookingStatuses((current) => ({ ...current, [booking.id]: result.status }));
      setMessages((current) => ({
        ...current,
        [booking.id]: result.customerNotification?.sent
          ? `Booking ${status} and SMS sent to the customer.`
          : `Booking ${status}, but the customer SMS could not be sent. Please contact them directly.${result.customerNotification?.reason ? ` ${result.customerNotification.reason}` : ""}`,
      }));
    } catch (error) {
      setMessages((current) => ({ ...current, [booking.id]: error.message || "We could not update this booking." }));
    } finally {
      setBusyBookingId("");
    }
  }

  return <section className="worker-booking-history" aria-labelledby="worker-bookings-title">
    <div className="worker-section-heading"><div><span className="worker-kicker">YOUR BOOKINGS</span><h2 id="worker-bookings-title">Booking history</h2></div><span className="worker-booking-count">{bookings.length} {bookings.length === 1 ? "request" : "requests"}</span></div>
    {bookings.length ? <div className="worker-booking-list">{bookings.map((booking) => {
      const status = bookingStatuses[booking.id] ?? booking.status;
      const statusLabel = typeof status === "string" ? status.replace("_", " ") : "Status unavailable";
      return <article className="worker-booking-item" key={booking.id}>
      <div className="worker-booking-item-heading"><div><h3>{booking.customer_name}</h3><span>{formatDate(booking.service_date)}</span></div><span className={`worker-booking-status status-${typeof status === "string" ? status : "unknown"}`}>{statusLabel}</span></div>
      <div className="worker-booking-details"><span><strong>Phone</strong>{booking.customer_phone}</span><span><strong>Location</strong>{booking.address}</span><span><strong>Budget</strong>{formatBudget(booking.budget_kobo)}</span></div>
      <p>{booking.request_details}</p>
      {status === "pending" ? (
        <div className="worker-booking-actions">
          <button type="button" className="worker-booking-accept" disabled={busyBookingId !== ""} onClick={() => respondToBooking(booking, "accepted")}>
            {busyBookingId === booking.id ? "Updating…" : "Accept booking"}
          </button>
          <button type="button" className="worker-booking-decline" disabled={busyBookingId !== ""} onClick={() => respondToBooking(booking, "declined")}>
            {busyBookingId === booking.id ? "Updating…" : "Decline"}
          </button>
        </div>
      ) : null}
      {messages[booking.id] ? <p className="worker-booking-response-message" role="status">{messages[booking.id]}</p> : null}
    </article>;
    })}</div> : <div className="worker-history-empty"><h3>No booking requests yet</h3><p>New customer requests will appear here when someone books your services.</p></div>}
  </section>;
}
