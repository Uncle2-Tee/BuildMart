import Link from "next/link";
import Image from "next/image";
import WorkerRatingForm from "../../worker-rating-form";

export const metadata = {
  title: "Rate your worker | BuildMart Ghana",
};

export default function WorkerRatingPage() {
  return (
    <main className="worker-page">
      <header className="worker-header"><Link className="worker-brand" href="/" aria-label="BuildMart Ghana home"><Image className="worker-brand-logo" src="/buildmart-logo.png" alt="BuildMart Ghana" width={934} height={198} priority /></Link><Link className="worker-back-link" href="/workers">Back to workers <span>↗</span></Link></header>
      <section className="worker-rating-page">
        <span className="worker-kicker">CLOSE THE LOOP</span>
        <h1>How did the work go?</h1>
        <p>Enter your booking reference and the email used when booking to share your feedback.</p>
        <WorkerRatingForm />
      </section>
    </main>
  );
}
