"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export default function SignOutButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setMessage(`Sign out failed: ${error.message || "Please try again."}`);
      setBusy(false);
    }
  }

  return (
    <span className="sign-out-control">
      <button className="sign-out-button" type="button" onClick={signOut} disabled={busy}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </svg>
        <span>{busy ? "Signing out…" : "Sign out"}</span>
      </button>
      {message ? <span className="sign-out-error" role="alert">{message}</span> : null}
    </span>
  );
}
