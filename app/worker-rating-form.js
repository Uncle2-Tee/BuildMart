"use client";

import { useState } from "react";

export default function WorkerRatingForm() {
  const [form, setForm] = useState({ bookingId: "", customerEmail: "", stars: 0, review: "" });
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

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

  if (saved) return <div className="worker-rating-success"><span className="worker-success-mark">✓</span><h2>Thank you for sharing.</h2><p>Your rating has been added to the worker&apos;s profile.</p></div>;

  return <form className="worker-rating-form" onSubmit={submit}>
    <label>Booking reference<input required value={form.bookingId} onChange={(event) => setForm({ ...form, bookingId: event.target.value })} placeholder="Paste the full booking ID" /></label>
    <label>Email used for booking<input required type="email" value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} /></label>
    <fieldset><legend>Your rating</legend><div className="worker-rating-picker">{[1, 2, 3, 4, 5].map((star) => <button key={star} className={form.stars >= star ? "selected" : ""} type="button" onClick={() => setForm({ ...form, stars: star })} aria-label={`${star} stars`}>★</button>)}</div></fieldset>
    <label>Review (optional)<textarea rows={5} value={form.review} onChange={(event) => setForm({ ...form, review: event.target.value })} maxLength={1000} placeholder="Tell future customers about your experience." /></label>
    {message ? <p className="worker-form-message" role="alert">{message}</p> : null}
    <button className="worker-primary-button" type="submit" disabled={!form.stars}>Submit rating</button>
  </form>;
}
