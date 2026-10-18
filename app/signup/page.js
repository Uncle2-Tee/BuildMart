import AccountLayout from "../account-layout";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, isSupabaseConfigured } from "../../lib/supabase/server";

export const metadata = {
  title: "Sign up | BuildMart Ghana",
};

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;
  const initialRole = params.role === "seller" || params.role === "buyer"
    ? params.role
    : "";

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient({ readOnly: true });
    const { data, error } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (error && error.status !== 400 && error.status !== 401) {
      throw new Error(`Unable to verify account: ${error.message}`);
    }

    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError) throw new Error(`Unable to load account permissions: ${profileError.message}`);

      redirect(profile.role === "admin"
        ? "/admin"
        : profile.role === "seller"
          ? "/dashboard/seller"
          : "/dashboard/buyer/orders");
    }
  }

  return <AccountLayout mode="signup" initialRole={initialRole} />;
}
