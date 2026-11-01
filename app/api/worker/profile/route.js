import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isSameOriginRequest } from "../../../../lib/request-origin";
import { notifyAdminBySms } from "../../../../lib/arkesel";

export async function PATCH(request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  const supabase = await createSupabaseServerClient({ readOnly: true });
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub || !isSupabaseAdminConfigured()) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  let body; try { body = await request.json(); } catch { return Response.json({ error: "Profile details must be valid JSON." }, { status: 400 }); }
  const required = ["name", "trade", "location", "phone", "bio"];
  if (required.some((key) => typeof body?.[key] !== "string" || !body[key].trim())) return Response.json({ error: "Complete every required profile field." }, { status: 400 });
  const years = Number(body.yearsExperience);
  if (!Number.isInteger(years) || years < 0 || years > 80) return Response.json({ error: "Enter valid experience details." }, { status: 400 });
  const trades = ["Mason", "Painter", "Labourer", "Tiler", "Carpenter", "Electrician", "Plumber", "Welder", "Other"];
  if (!trades.includes(body.trade)) return Response.json({ error: "Choose a valid trade." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: savedProfile, error: saveError } = await admin.from("worker_profiles").update({ name: body.name.trim(), trade: body.trade, location: body.location.trim(), phone: body.phone.trim(), bio: body.bio.trim(), years_experience: years, hourly_rate_kobo: null, approval_status: "pending", is_active: false }).eq("profile_id", data.claims.sub).select("id, name, trade").maybeSingle();
  if (saveError) { console.error("Unable to save worker profile", saveError); return Response.json({ error: "We couldn't save your worker profile." }, { status: 500 }); }
  if (!savedProfile) return Response.json({ error: "Worker profile not found. Please sign in again." }, { status: 404 });
  await notifyAdminBySms(
    "worker-profile-submitted",
    `BuildMart: Pending worker approval — ${savedProfile.name} (${savedProfile.trade}) submitted a profile for review.`,
  );
  return Response.json({ ok: true });
}
