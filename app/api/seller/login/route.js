import { isSameOriginRequest } from "../../../../lib/request-origin";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../lib/supabase/admin";
import { createSupabasePublicClient } from "../../../../lib/supabase/server";

const invalidCredentials = () => Response.json(
  { error: "Invalid seller name or password." },
  { status: 401 },
);

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter your seller name and password." }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name || name.length > 100 || !password || password.length > 128) {
    return Response.json({ error: "Enter your seller name and password." }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return Response.json({ error: "Seller login is not configured." }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const { data: sellers, error: sellerError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "seller")
    .ilike("display_name", name.replace(/[\\%_]/g, "\\$&"))
    .limit(2);

  if (sellerError) {
    console.error("Unable to look up seller login", sellerError);
    return Response.json({ error: "We couldn't verify your seller account. Please try again." }, { status: 500 });
  }

  if (sellers?.length !== 1) return invalidCredentials();

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(sellers[0].id);
  if (authUserError) {
    console.error("Unable to load seller login identity", authUserError);
    return Response.json({ error: "We couldn't verify your seller account. Please try again." }, { status: 500 });
  }
  if (!authUser.user?.email) return invalidCredentials();

  const supabase = createSupabasePublicClient();
  if (!supabase) {
    return Response.json({ error: "Seller login is not configured." }, { status: 503 });
  }

  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: authUser.user.email,
    password,
  });

  if (signInError || authData.user?.id !== sellers[0].id || !authData.session) return invalidCredentials();

  return Response.json({
    session: {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    },
  });
}
