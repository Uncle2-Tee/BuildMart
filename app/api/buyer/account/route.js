import { isSameOriginRequest } from "../../../../lib/request-origin";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../lib/supabase/admin";
import { createSupabasePublicClient } from "../../../../lib/supabase/server";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const accessToken = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!accessToken) {
    return Response.json({ error: "Sign in to continue as a buyer." }, { status: 401 });
  }

  const supabase = createSupabasePublicClient();
  if (!supabase || !isSupabaseAdminConfigured()) {
    return Response.json({ error: "Buyer account registration is not configured." }, { status: 503 });
  }

  const { data, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !data.user) {
    return Response.json({ error: "Sign in to continue as a buyer." }, { status: 401 });
  }

  const user = data.user;
  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to load buyer profile during account setup", profileError);
    return Response.json({ error: "We couldn't verify your buyer account." }, { status: 500 });
  }

  if (profile?.role && profile.role !== "buyer") {
    return Response.json({ error: "This account is reserved for another BuildMart role." }, { status: 403 });
  }

  if (!profile && user.user_metadata?.account_type !== "buyer") {
    return Response.json({ error: "This account is not registered as a buyer." }, { status: 403 });
  }

  const displayName = typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name.trim().slice(0, 100)
    : "";
  const fallbackName = typeof user.email === "string" ? user.email.split("@")[0].slice(0, 100) : "Buyer";
  const { error: saveError } = await admin.from("profiles").upsert({
    id: user.id,
    display_name: displayName || profile?.display_name || fallbackName,
    role: "buyer",
  });

  if (saveError) {
    console.error("Unable to create buyer profile", saveError);
    return Response.json({ error: "We couldn't prepare your buyer account. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
