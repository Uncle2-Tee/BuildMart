import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="brand footer-brand" aria-label="BuildMart Ghana">
        <span className="mark brand-mark">B</span>
        <span>BuildMart<span className="brand-country">GH</span></span>
      </div>
      <span>Better projects start close to home.</span>
      <div>
        <Link href="/login">Seller portal</Link>
        <span>© {new Date().getFullYear()} BuildMart Ghana</span>
      </div>
    </footer>
  );
}
