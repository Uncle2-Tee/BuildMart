import Link from "next/link";
import AccountForm from "./account-form";
import { isSupabaseConfigured } from "../lib/supabase/server";

export default function AccountLayout({ mode, initialRole = "", setup, check, recoveryError = false }) {
  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  const isForgot = mode === "forgot";

  return (
    <main className="account-page">
      <section className={`account-card${isSignup ? " signup-card" : " login-card"}`}>
        <Link className="brand account-brand" href="/" aria-label="BuildMart home">
          <span className="mark brand-mark">B</span><span>BuildMart<span className="brand-country">GH</span></span>
        </Link>
        {!isSignup ? <span className="eyebrow muted-eyebrow">{isReset || isForgot ? "ACCOUNT SECURITY" : "YOUR BUILDMART ACCOUNT"}</span> : null}
        {!isSignup ? <h1>{isReset ? "Reset Password" : isForgot ? "Forgot Password?" : "Welcome Back"}</h1> : null}
        <p className="account-intro">
          {isSignup
            ? "Create your account to shop or start your seller journey."
            : isReset
              ? "Choose a new password for your BuildMart account."
              : isForgot
                ? "Enter the email address linked to your account. We’ll send you a secure reset link."
                : "Log in to continue to your BuildMart account."}
        </p>
        {!isSupabaseConfigured() ? (
          <div className="catalog-notice" role="status">
            <strong>Account setup is not complete.</strong>
            <span>Add Supabase credentials to enable secure accounts.</span>
          </div>
        ) : <AccountForm mode={mode} initialRole={initialRole} recoveryError={recoveryError} />}
        {setup ? <p className="setup-hint">The account portal will be available once setup is complete.</p> : null}
        {check ? <p className="success-message">Check your inbox to confirm your account, then log in.</p> : null}
      </section>
    </main>
  );
}
