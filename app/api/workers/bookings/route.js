import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../lib/request-origin";
import { sendArkeselSmsWithResult } from "../../../../lib/arkesel";

export async function POST(request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (!isSupabaseAdminConfigured()) return Response.json({ error: "Worker bookings are not configured." }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Booking details must contain valid JSON." }, { status: 400 }); }
  const values = ["workerId", "customerName", "customerEmail", "customerPhone", "serviceDate", "address", "requestDetails"];
  if (values.some((key) => typeof body?.[key] !== "string" || !body[key].trim())) return Response.json({ error: "Complete all required booking details." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customerEmail.trim())) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const serviceDate = new Date(`${body.serviceDate}T00:00:00Z`);
  if (Number.isNaN(serviceDate.getTime()) || serviceDate < new Date(new Date().toISOString().slice(0, 10))) return Response.json({ error: "Choose a future service date." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: worker, error: workerError } = await admin.from("worker_profiles").select("id, name, trade, phone, is_active, approval_status").eq("id", body.workerId).maybeSingle();
  if (workerError) { console.error("Unable to verify worker", workerError); return Response.json({ error: "We could not verify this worker." }, { status: 500 }); }
  if (!worker?.is_active || worker.approval_status !== "approved") return Response.json({ error: "This worker is not currently available." }, { status: 409 });
  const budget = body.budget ? Math.round(Number(body.budget.replace(/[^0-9.]/g, "")) * 100) : null;
  if (body.budget && (!Number.isSafeInteger(budget) || budget < 1)) return Response.json({ error: "Enter a valid budget." }, { status: 400 });
  const { data: booking, error } = await admin.from("worker_bookings").insert({ worker_id: body.workerId, customer_name: body.customerName.trim(), customer_email: body.customerEmail.trim().toLowerCase(), customer_phone: body.customerPhone.trim(), service_date: body.serviceDate, address: body.address.trim(), request_details: body.requestDetails.trim(), budget_kobo: budget }).select("id").single();
  if (error) { console.error("Unable to create worker booking", error); return Response.json({ error: "We could not send your booking request." }, { status: 500 }); }
  const workerNotification = await sendArkeselSmsWithResult(
    "worker-booking-created",
    worker.phone,
    `BuildMart: New booking request for ${worker.name} (${worker.trade}) from ${body.customerName.trim()}. Date: ${body.serviceDate}. Location: ${body.address.trim()}. Customer: ${body.customerPhone.trim()}. Booking ID: ${booking.id}. Sign in to your worker dashboard to accept or decline.`,
  );
  return Response.json({ bookingId: booking.id, workerNotification }, { status: 201 });
}
