import Link from "next/link";
import AccountForm from "./account-form";
import { isSupabaseConfigured } from "../lib/supabase/server";

export default function AccountLayout({ mode, initialRole = "", setup, check, recoveryError = false, redirectTo = "", hideSignupLink = false }) {
  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  const isForgot = mode === "forgot";

  return (
    <main className="account-page">
      <section className={`account-card${isSignup ? " signup-card" : " login-card"}`}>
        <Link className="brand account-brand" href="/" aria-label="BuildMart home">
          <span className="mark brand-mark">B</span><span>BuildMart<span className="brand-country">GH</span></span>
        </Link>
        {isReset || isForgot ? <span className="eyebrow muted-eyebrow">ACCOUNT SECURITY</span> : null}
        <h1 className={mode === "login" || isForgot ? "login-heading" : undefined}>
          {isSignup ? "Create your account" : isReset ? "Reset Password" : isForgot ? "Forgot Password?" : "Welcome Back"}
        </h1>
        <p className="account-intro">
          {isSignup
            ? "Sign up with an email or phone number to join BuildMart."
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
        ) : <AccountForm mode={mode} initialRole={initialRole} recoveryError={recoveryError} redirectTo={redirectTo} hideSignupLink={hideSignupLink} />}
        {setup ? <p className="setup-hint">The account portal will be available once setup is complete.</p> : null}
        {check ? (
          <p className="success-message">
            {check === "email-sent"
              ? "Check your email and confirm your address before logging in."
              : check === "phone"
              ? "Your phone number is verified. Log in to continue."
              : check === "email"
                ? "Your email is confirmed. Log in to continue."
                : check === "created"
                  ? "Your account is ready. Log in to continue."
                  : "Check your inbox to confirm your account, then log in."}
          </p>
        ) : null}
      </section>
    </main>
  );
}
