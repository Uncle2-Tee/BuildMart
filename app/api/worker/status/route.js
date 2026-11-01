import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isSameOriginRequest } from "../../../../lib/request-origin";
import { clearWorkerDirectoryCache } from "../../../../lib/worker-directory-cache";

export async function PATCH(request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  const supabase = await createSupabaseServerClient({ readOnly: true });
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!isSupabaseAdminConfigured()) return Response.json({ error: "Worker availability is not configured." }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Availability details must be valid JSON." }, { status: 400 }); }
  if (typeof body?.active !== "boolean") return Response.json({ error: "Choose a valid availability status." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: worker, error: workerError } = await admin
    .from("worker_profiles")
    .select("id, approval_status")
    .eq("profile_id", data.claims.sub)
    .maybeSingle();
  if (workerError) { console.error("Unable to load worker availability", workerError); return Response.json({ error: "We could not update your availability." }, { status: 500 }); }
  if (!worker) return Response.json({ error: "Worker profile not found." }, { status: 404 });
  if (worker.approval_status !== "approved") return Response.json({ error: "Your profile must be approved before availability can be changed." }, { status: 403 });

  const { error: updateError } = await admin.from("worker_profiles").update({ is_active: body.active }).eq("id", worker.id);
  if (updateError) { console.error("Unable to update worker availability", updateError); return Response.json({ error: "We could not update your availability." }, { status: 500 }); }
  clearWorkerDirectoryCache();
  return Response.json({ active: body.active });
}
