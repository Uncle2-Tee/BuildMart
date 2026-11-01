function formatDate(value) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatBudget(value) {
  if (!value) return "Budget not specified";
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(value / 100);
}

export default function WorkerBookingHistory({ bookings }) {
  return <section className="worker-booking-history" aria-labelledby="worker-bookings-title">
    <div className="worker-section-heading"><div><span className="worker-kicker">YOUR BOOKINGS</span><h2 id="worker-bookings-title">Booking history</h2></div><span className="worker-booking-count">{bookings.length} {bookings.length === 1 ? "request" : "requests"}</span></div>
    {bookings.length ? <div className="worker-booking-list">{bookings.map((booking) => <article className="worker-booking-item" key={booking.id}>
      <div className="worker-booking-item-heading"><div><h3>{booking.customer_name}</h3><span>{formatDate(booking.service_date)}</span></div><span className={`worker-booking-status status-${booking.status}`}>{booking.status.replace("_", " ")}</span></div>
      <div className="worker-booking-details"><span><strong>Phone</strong>{booking.customer_phone}</span><span><strong>Location</strong>{booking.address}</span><span><strong>Budget</strong>{formatBudget(booking.budget_kobo)}</span></div>
      <p>{booking.request_details}</p>
    </article>)}</div> : <div className="worker-history-empty"><h3>No booking requests yet</h3><p>New customer requests will appear here when someone books your services.</p></div>}
  </section>;
}
