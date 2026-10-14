import Link from "next/link";
import AccountForm from "../account-form";
import { isSupabaseConfigured } from "../../lib/supabase/server";

export const metadata = {
  title: "Sign in | BuildMart Ghana",
};

export default async function AccountPage({ searchParams }) {
  const params = await searchParams;
  return (
    <main className="account-page">
      <div className="account-card">
        <Link className="brand account-brand" href="/">
          <span className="mark brand-mark">B</span><span>buildmart<span className="brand-country">GH</span></span>
        </Link>
        <span className="eyebrow muted-eyebrow">BUYER, SELLER & ADMIN PORTAL</span>
        <h1>Welcome to<br /><em>BuildMart.</em></h1>
        <p className="account-intro">Sign in to shop or manage your store, or create an account to get started.</p>
        {!isSupabaseConfigured() ? (
          <div className="catalog-notice" role="status">
            <strong>Account setup is not complete.</strong>
            <span>Add Supabase credentials and apply the database migration to enable secure accounts.</span>
          </div>
        ) : (
          <AccountForm
            initialMode={params.mode === "signup" ? "signup" : "login"}
            initialRole={params.role === "seller" ? "seller" : "buyer"}
          />
        )}
        {params.setup ? <p className="setup-hint">The account portal will be available once setup is complete.</p> : null}
        {params.check ? <p className="success-message">Check your inbox to confirm your seller account.</p> : null}
        <Link className="back-link" href="/">← Back to the marketplace</Link>
      </div>
      <div className="account-aside">
        <span className="eyebrow">BUILT FOR LOCAL BUSINESS</span>
        <h2>Good work<br />finds its people.</h2>
        <p>Shop Ghanaian businesses, or grow your own store in a community building better homes and projects.</p>
        <span className="account-aside-mark">B.</span>
      </div>
    </main>
  );
}
