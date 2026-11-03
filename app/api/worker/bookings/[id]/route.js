import { sendArkeselSmsWithResult } from "../../../../../lib/arkesel";
import { isSameOriginRequest } from "../../../../../lib/request-origin";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  if (!isSupabaseAdminConfigured()) {
    return Response.json({ error: "Worker bookings are not configured." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient({ readOnly: true });
  if (!supabase) {
    return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  }
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const profileId = claimsData?.claims?.sub;
  if (claimsError || !profileId) {
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return Response.json({ error: "Booking not found." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Booking response must contain valid JSON." }, { status: 400 });
  }
  if (!["accepted", "declined"].includes(body?.status)) {
    return Response.json({ error: "Choose accept or decline for this booking." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: worker, error: workerError } = await admin
    .from("worker_profiles")
    .select("id, name, trade, phone")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (workerError) {
    console.error("Unable to verify worker booking access", workerError);
    return Response.json({ error: "We could not verify your worker account." }, { status: 500 });
  }
  if (!worker) {
    return Response.json({ error: "Worker profile not found." }, { status: 404 });
  }

  const { data: booking, error: bookingError } = await admin
    .from("worker_bookings")
    .select("id, customer_phone, service_date, status")
    .eq("id", id)
    .eq("worker_id", worker.id)
    .maybeSingle();
  if (bookingError) {
    console.error("Unable to load worker booking", bookingError);
    return Response.json({ error: "We could not load this booking." }, { status: 500 });
  }
  if (!booking) {
    return Response.json({ error: "Booking not found." }, { status: 404 });
  }
  if (booking.status !== "pending") {
    return Response.json({ error: "This booking has already been answered." }, { status: 409 });
  }

  const { data: updatedBooking, error: updateError } = await admin
    .from("worker_bookings")
    .update({ status: body.status })
    .eq("id", booking.id)
    .eq("worker_id", worker.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (updateError) {
    console.error("Unable to update worker booking response", updateError);
    return Response.json({ error: "We could not update this booking." }, { status: 500 });
  }
  if (!updatedBooking) {
    return Response.json({ error: "This booking has already been answered. Refresh your dashboard." }, { status: 409 });
  }

  const decisionLabel = body.status === "accepted" ? "Accepted" : "Declined";
  const customerNotification = await sendArkeselSmsWithResult(
    `worker-booking-${body.status}`,
    booking.customer_phone,
    `BuildMart: Booking ${decisionLabel}. ${worker.name} (${worker.trade}) has ${body.status} your booking for ${booking.service_date}. Worker contact: ${worker.phone}.`,
  );

  return Response.json({
    status: body.status,
    customerNotification,
  });
}
