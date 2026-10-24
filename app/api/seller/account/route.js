import { isSameOriginRequest } from "../../../../lib/request-origin";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../lib/supabase/admin";
import { createSupabasePublicClient } from "../../../../lib/supabase/server";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = /^Bearer\s+(.+)$/i.exec(authorization)?.[1];
  if (!accessToken) {
    return Response.json({ error: "Sign in to continue as a seller." }, { status: 401 });
  }

  const supabase = createSupabasePublicClient();
  if (!supabase) {
    return Response.json({ error: "Seller account registration is not configured." }, { status: 503 });
  }

  const { data, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !data.user) {
    return Response.json({ error: "Sign in to continue as a seller." }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return Response.json({ error: "Seller account registration is not configured." }, { status: 503 });
  }

  const user = data.user;
  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, display_name, seller_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to load seller profile during account setup", profileError);
    return Response.json({ error: "We couldn't verify your seller account." }, { status: 500 });
  }

  if (profile?.role === "admin") {
    return Response.json({ error: "Administrator accounts cannot be used as seller accounts." }, { status: 403 });
  }

  if (profile?.role === "seller") {
    return Response.json({ ok: true });
  }

  if (user.user_metadata?.account_type !== "seller") {
    return Response.json({ error: "This account is not registered as a seller. Create a seller account to continue." }, { status: 403 });
  }

  const displayName = typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name.trim().slice(0, 100)
    : "";
  const fallbackName = typeof user.email === "string" ? user.email.split("@")[0].slice(0, 100) : "Seller";
  const { error: saveError } = await admin.from("profiles").upsert({
    id: user.id,
    display_name: displayName || profile?.display_name || fallbackName,
    role: "seller",
    seller_status: "pending",
  });

  if (saveError) {
    console.error("Unable to create seller profile", saveError);
    return Response.json({ error: "We couldn't prepare your seller account. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
