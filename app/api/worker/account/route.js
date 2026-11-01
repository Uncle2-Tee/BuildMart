import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../lib/supabase/admin";
import { createSupabasePublicClient } from "../../../../lib/supabase/server";
import { isSameOriginRequest } from "../../../../lib/request-origin";

export async function POST(request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabase = createSupabasePublicClient();
  if (!token || !supabase || !isSupabaseAdminConfigured()) return Response.json({ error: "Worker account setup is not configured." }, { status: 503 });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (data.user.user_metadata?.account_type !== "worker") return Response.json({ error: "This account is not registered as a worker." }, { status: 403 });
  const admin = createSupabaseAdminClient();
  const { data: existingProfile, error: existingProfileError } = await admin
    .from("worker_profiles")
    .select("id")
    .eq("profile_id", data.user.id)
    .maybeSingle();

  if (existingProfileError) {
    console.error("Unable to check existing worker profile", existingProfileError);
    return Response.json({ error: "We couldn't verify your worker profile." }, { status: 500 });
  }

  if (existingProfile) return Response.json({ ok: true });

  const trade = ["Mason", "Painter", "Labourer", "Tiler", "Carpenter", "Electrician", "Plumber", "Welder", "Other"].includes(data.user.user_metadata?.trade)
    ? data.user.user_metadata.trade
    : "Other";
  const { error: saveError } = await admin.from("worker_profiles").insert({
    profile_id: data.user.id,
    name: String(data.user.user_metadata?.display_name || data.user.email?.split("@")[0] || "Worker").trim().slice(0, 100),
    trade,
    location: "Ghana",
    phone: "Not provided",
    bio: "",
    approval_status: "pending",
    is_active: false,
  });
  if (saveError) { console.error("Unable to create worker profile", saveError); return Response.json({ error: "We couldn't create your worker profile." }, { status: 500 }); }
  return Response.json({ ok: true });
}
