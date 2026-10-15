import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/signup");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(`Unable to verify account: ${userError.message}`);
  if (!user) redirect("/signup");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error(`Unable to load account permissions: ${profileError.message}`);

  if (profile.role === "buyer") redirect("/dashboard/buyer");
  if (profile.role === "seller") redirect("/dashboard/seller");
  if (profile.role === "admin") redirect("/admin");

  throw new Error("This account does not have a supported role.");
}
