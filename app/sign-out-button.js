"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export default function SignOutButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function signOut() {
    const { error } = await createSupabaseBrowserClient().auth.signOut();
    if (error) {
      setMessage(`Sign out failed: ${error.message}`);
      return;
    }
    router.replace("/account");
    router.refresh();
  }

  return (
    <span className="sign-out-control">
      <button type="button" onClick={signOut}>Sign out</button>
      {message ? <span className="sign-out-error" role="alert">{message}</span> : null}
    </span>
  );
}
