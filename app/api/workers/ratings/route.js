import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../lib/request-origin";

export async function POST(request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (!isSupabaseAdminConfigured()) return Response.json({ error: "Worker ratings are not configured." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Rating details must contain valid JSON." }, { status: 400 }); }
  const stars = Number(body?.stars);
  if (typeof body?.bookingId !== "string" || !body.bookingId.trim() || typeof body?.customerEmail !== "string" || !body.customerEmail.trim() || !Number.isInteger(stars) || stars < 1 || stars > 5) return Response.json({ error: "Provide a valid booking and rating." }, { status: 400 });
  const customerEmail = body.customerEmail.trim().toLowerCase();
  const admin = createSupabaseAdminClient();
  const { data: booking, error: bookingError } = await admin.from("worker_bookings").select("id, worker_id, customer_email").eq("id", body.bookingId.trim()).maybeSingle();
  if (bookingError) { console.error("Unable to load worker booking", bookingError); return Response.json({ error: "We could not verify this booking." }, { status: 500 }); }
  if (!booking || booking.customer_email !== customerEmail) return Response.json({ error: "The booking reference and email must match the details used to book." }, { status: 403 });
  const { error: ratingError } = await admin.from("worker_ratings").insert({ booking_id: booking.id, worker_id: booking.worker_id, customer_email: customerEmail, stars, review: typeof body.review === "string" ? body.review.trim() : "" });
  if (ratingError) return Response.json({ error: ratingError.code === "23505" ? "This booking has already been rated." : "We could not save your rating." }, { status: ratingError.code === "23505" ? 409 : 500 });
  return Response.json({ saved: true });
}
