import { getApiRole } from "../../../../../../lib/auth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../../../lib/request-origin";
import { notifyAdminBySms, sendArkeselSmsWithResult } from "../../../../../../lib/arkesel";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request, { params }) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  const auth = await getApiRole(["admin"]);
  if (auth.response) return auth.response;
  if (!isSupabaseAdminConfigured()) return Response.json({ error: "Worker approval is not configured." }, { status: 503 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return Response.json({ error: "Worker not found." }, { status: 404 });
  let body; try { body = await request.json(); } catch { return Response.json({ error: "Approval details must be valid JSON." }, { status: 400 }); }
  if (!["approved", "rejected"].includes(body?.status)) return Response.json({ error: "Choose an approval status." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("worker_profiles").update({ approval_status: body.status, is_active: body.status === "approved" }).eq("id", id).select("approval_status, name, trade, phone").maybeSingle();
  if (error) { console.error("Unable to update worker approval", error); return Response.json({ error: "We couldn't update this worker." }, { status: 500 }); }
  if (!data) return Response.json({ error: "Worker not found." }, { status: 404 });
  const workerNotification = await sendArkeselSmsWithResult(
    `worker-profile-${data.approval_status}`,
    data.phone,
    data.approval_status === "approved"
      ? `BuildMart: Worker profile approved — ${data.name}. Your profile is now visible in the worker directory.`
      : `BuildMart: Worker profile rejected — ${data.name}. Please update your profile and submit it again.`,
  );
  await notifyAdminBySms(
    `worker-profile-${data.approval_status}-admin`,
    `BuildMart: Worker profile ${data.name} (${data.trade}) was ${data.approval_status} by an admin.`,
  );
  return Response.json({ status: data.approval_status, workerNotification });
}
