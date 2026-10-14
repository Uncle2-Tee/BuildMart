"use client";

import { createBrowserClient } from "@supabase/ssr";

let client;

export function createSupabaseBrowserClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase is not configured. Add its public URL and anon key.");
  }

  client = createBrowserClient(url, key);
  return client;
}
