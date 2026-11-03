"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";

const trades = ["All trades", "Mason", "Painter", "Labourer", "Tiler", "Carpenter", "Electrician", "Plumber", "Welder", "Other"];

function formatRate(rateKobo) {
  if (!rateKobo) return "Rate agreed after brief";
  return `${new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(rateKobo / 100)} / hour`;
}

function Stars({ value = 0 }) {
  return <span className="worker-stars" aria-label={`${value.toFixed(1)} out of 5 stars`}>{"★".repeat(Math.round(value))}<span>{"★".repeat(5 - Math.round(value))}</span></span>;
}

function tradeClass(trade) {
  return `worker-card-trade-${trade.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function BookingForm({ worker, onClose }) {
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerPhone: "", serviceDate: "", address: "", requestDetails: "", budget: "" });
  const [state, setState] = useState({ busy: false, message: "", success: false, bookingId: "" });

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setState({ busy: true, message: "", success: false });
    try {
      const response = await fetch("/api/workers/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workerId: worker.id, ...form }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not send your booking request.");
      setState({
        busy: false,
        message: result.workerNotification?.sent
          ? "Your booking request has been sent. The worker was notified by SMS and will respond to your request."
          : `Your booking request was saved, but we could not notify the worker by SMS. Please contact ${worker.name} directly at ${worker.phone}.`,
        success: true,
        bookingId: result.bookingId,
      });
    } catch (error) {
      setState({ busy: false, message: error.message, success: false });
    }
  }

  if (state.success) return <div className="worker-modal-success"><span className="worker-success-mark">✓</span><h3>Request sent</h3><p>{state.message}</p><small className="worker-booking-reference">Save your booking ID: <strong>{state.bookingId}</strong></small><button className="worker-primary-button" type="button" onClick={onClose}>Done</button></div>;

  return <form className="worker-booking-form" onSubmit={submit}>
    <div className="worker-modal-heading"><div><span className="worker-kicker">BOOK A PROFESSIONAL</span><h2>{worker.name}</h2><p>{worker.trade} · {worker.location}</p></div><button className="worker-close" type="button" onClick={onClose} aria-label="Close booking form">×</button></div>
    <div className="worker-form-grid">
      <label>Name<input name="customerName" required value={form.customerName} onChange={update} placeholder="e.g. Ama Mensah" /></label>
      <label>Email<input name="customerEmail" type="email" required value={form.customerEmail} onChange={update} placeholder="e.g. ama@example.com" /></label>
      <label>Phone<input name="customerPhone" required value={form.customerPhone} onChange={update} placeholder="e.g. 024 123 4567" /></label>
      <label>Preferred date<input name="serviceDate" type="date" required min={new Date().toISOString().slice(0, 10)} value={form.serviceDate} onChange={update} /></label>
      <label className="worker-form-full">Work address<input name="address" required value={form.address} onChange={update} placeholder="e.g. 12 Oxford Street, Accra" /></label>
      <label className="worker-form-full">Tell them about the job<textarea name="requestDetails" required minLength={10} rows={4} value={form.requestDetails} onChange={update} placeholder="What needs to be done? Include useful measurements or materials." /></label>
      <label>Budget (optional)<input name="budget" inputMode="numeric" value={form.budget} onChange={update} placeholder="e.g. 1,500 GHS" /></label>
    </div>
    {state.message ? <p className="worker-form-message" role="alert">{state.message}</p> : null}
    <button className="worker-primary-button" type="submit" disabled={state.busy}>{state.busy ? "Sending request…" : "Send booking request"}</button>
  </form>;
}

export default function WorkerMarketplace({ workers }) {
  const [trade, setTrade] = useState("All trades");
  const [search, setSearch] = useState("");
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const filteredWorkers = useMemo(() => {
    const searchTerms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return workers.filter((worker) => {
      if (trade !== "All trades" && worker.trade !== trade) return false;
      const searchableText = `${worker.name} ${worker.trade} ${worker.location} ${worker.phone} ${worker.bio}`.toLowerCase();
      return searchTerms.every((term) => searchableText.includes(term));
    });
  }, [search, trade, workers]);

  return <main className="worker-page">
    <header className={`worker-header${mobileMenuOpen ? " worker-mobile-menu-open" : ""}`}>
      <Link className="worker-brand" href="/" aria-label="BuildMart Ghana home"><Image className="worker-brand-logo" src="/buildmart-logo.png" alt="BuildMart Ghana" width={934} height={198} priority /></Link>
      <span className="worker-header-actions">
        <Link className="worker-join-link" href="/worker/login">Join as a worker</Link>
        <Link className="worker-back-link" href="/">Back to marketplace <span>↗</span></Link>
      </span>
      <button
        className="worker-menu-button"
        type="button"
        aria-label={mobileMenuOpen ? "Close workers menu" : "Open workers menu"}
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav className="worker-mobile-menu" aria-label="Workers navigation">
        <Link className="worker-join-link" href="/worker/login" onClick={() => setMobileMenuOpen(false)}>Join as a worker</Link>
        <Link className="worker-back-link" href="/" onClick={() => setMobileMenuOpen(false)}>Back to marketplace <span>↗</span></Link>
      </nav>
    </header>
    <section className="worker-hero"><div><h1>Find trusted people<br /><em>for the work ahead.</em></h1></div></section>
    <section className="worker-directory" aria-labelledby="worker-directory-title"><div className="worker-directory-head"><div><span className="worker-kicker">THE WORKER DIRECTORY</span><h2 id="worker-directory-title">Who do you need today?</h2><Link className="worker-rate-button" href="/workers/rate">Rate a worker <span aria-hidden="true">★</span></Link></div><div className="worker-filters"><label className="worker-search-field"><span className="visually-hidden">Search workers</span><input aria-label="Search workers by name, location, trade or phone" placeholder="Search name, location or trade" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="worker-trade-select"><span className="visually-hidden">Filter by trade</span><select aria-label="Filter by trade" value={trade} onChange={(event) => setTrade(event.target.value)}>{trades.map((item) => <option key={item}>{item}</option>)}</select></label></div></div>
      {filteredWorkers.length ? <div className="worker-grid">{filteredWorkers.map((worker) => <article className={`worker-card ${tradeClass(worker.trade)}`} key={worker.id}>
        <div className="worker-card-top">
          <div className="worker-avatar-wrap">
            <div className="worker-avatar" style={worker.avatar_url ? { backgroundImage: `url("${worker.avatar_url}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{worker.avatar_url ? null : worker.name.slice(0, 1).toUpperCase()}</div>
            <span className="worker-available-dot" aria-label="Available professional" />
          </div>
          <div className="worker-card-identity">
            <span className="worker-trade">{worker.trade}</span>
            <h3>{worker.name}</h3>
            <p><span aria-hidden="true">⌖</span> {worker.location}</p>
            <a className="worker-phone-link" href={`tel:${worker.phone}`}><span aria-hidden="true">☎</span> {worker.phone}</a>
          </div>
          <span className="worker-verified-badge" title="Approved BuildMart professional" aria-label="Approved BuildMart professional">✓</span>
        </div>
        <div className="worker-rating">
          <Stars value={Number(worker.rating_average)} />
          <strong>{Number(worker.rating_average).toFixed(1)}</strong>
          <span>{worker.rating_count ? `${worker.rating_count} reviews` : "New profile"}</span>
        </div>
        <p className="worker-bio">{worker.bio || "A skilled professional ready to help with your project."}</p>
        <div className="worker-card-meta">
          <span><strong>{worker.years_experience}</strong> years experience</span>
          <span><strong>{formatRate(worker.hourly_rate_kobo)}</strong></span>
        </div>
        <button className="worker-primary-button" type="button" onClick={() => setSelectedWorker(worker)}>Book this professional <span>→</span></button>
      </article>)}</div> : <div className="worker-empty"><h3>No professionals match that search</h3><p>Try another trade, name or location.</p></div>}
    </section>
    {selectedWorker ? <div className="worker-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedWorker(null); }}><section className="worker-modal" role="dialog" aria-modal="true" aria-label={`Book ${selectedWorker.name}`}><BookingForm worker={selectedWorker} onClose={() => setSelectedWorker(null)} /></section></div> : null}
  </main>;
}
