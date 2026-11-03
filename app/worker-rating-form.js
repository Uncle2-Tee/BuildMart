"use client";

import { useState } from "react";

export default function WorkerRatingForm() {
  const [form, setForm] = useState({ bookingId: "", customerEmail: "", stars: 0, review: "" });
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [hoveredStars, setHoveredStars] = useState(0);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/workers/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "We could not save your rating.");
      return;
    }
    setSaved(true);
  }

  if (saved) return <div className="worker-rating-success" role="status" aria-live="polite"><span className="worker-success-mark" aria-hidden="true">✓</span><h2>Thank you for rating us.</h2><p>Your rating has been added to the worker&apos;s profile.</p></div>;

  return <form className="worker-rating-form" onSubmit={submit}>
    <label>Booking reference<input required value={form.bookingId} onChange={(event) => setForm({ ...form, bookingId: event.target.value })} placeholder="Paste the full booking ID" /></label>
    <label>Email used for booking<input required type="email" value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} placeholder="e.g. ama.mensah@example.com" /></label>
    <fieldset>
      <legend>Your rating</legend>
      <div className="worker-rating-picker" onMouseLeave={() => setHoveredStars(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const highlighted = (hoveredStars || form.stars) >= star;
          return (
            <button
              key={star}
              className={highlighted ? "selected" : "unselected"}
              type="button"
              onMouseEnter={() => setHoveredStars(star)}
              onFocus={() => setHoveredStars(star)}
              onBlur={() => setHoveredStars(0)}
              onClick={() => setForm((current) => ({ ...current, stars: current.stars === star ? 0 : star }))}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
              aria-pressed={form.stars === star}
            >
              ★
            </button>
          );
        })}
      </div>
      <div className="worker-rating-selection" aria-live="polite">
        <span>{form.stars ? `${form.stars} out of 5 stars selected` : "Select a rating"}</span>
        {form.stars ? <button type="button" onClick={() => setForm({ ...form, stars: 0 })}>Clear</button> : null}
      </div>
    </fieldset>
    <label>Review (optional)<textarea rows={5} value={form.review} onChange={(event) => setForm({ ...form, review: event.target.value })} maxLength={1000} placeholder="e.g. The work was neat, professional and completed on time." /></label>
    {message ? <p className="worker-form-message" role="alert">{message}</p> : null}
    <button className="worker-primary-button" type="submit" disabled={!form.stars}>Submit rating</button>
  </form>;
}
