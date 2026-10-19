import { getApiRole } from "../../../../../lib/auth";
import { invalidateApprovedProductCatalog } from "../../../../../lib/buyer-dashboard-data";
import { isSameOriginRequest } from "../../../../../lib/request-origin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const auth = await getApiRole(["seller"], { requireApprovedSeller: true });
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Product update must contain valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Product update must contain a JSON object." }, { status: 400 });
  }

  const updates = {};
  if (typeof body.active === "boolean") updates.active = body.active;

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 3 || title.length > 120) {
      return Response.json({ error: "Product names must be between 3 and 120 characters." }, { status: 400 });
    }
    updates.title = title;
  }

  if (body.price !== undefined) {
    const price = typeof body.price === "string" ? body.price.trim() : "";
    const priceMatch = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.exec(price);
    const priceKobo = priceMatch ? Math.round(Number(price) * 100) : 0;
    if (!priceMatch || priceKobo < 1 || priceKobo > 1000000000) {
      return Response.json({ error: "Enter a valid product price in Ghana cedis." }, { status: 400 });
    }
    updates.price_kobo = priceKobo;
  }

  if (!Object.keys(updates).length) {
    return Response.json({ error: "Choose a product name, price, or visibility change." }, { status: 400 });
  }

  const { data: product, error } = await auth.supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .eq("seller_id", auth.user.id)
    .select("id, title, price_kobo, active")
    .maybeSingle();

  if (error) {
    console.error("Seller product update failed", error);
    return Response.json({ error: "We couldn't update that product." }, { status: 500 });
  }
  if (!product) return Response.json({ error: "Product not found." }, { status: 404 });

  invalidateApprovedProductCatalog();
  return Response.json({ product });
}

export async function DELETE(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const auth = await getApiRole(["seller"], { requireApprovedSeller: true });
  if (auth.response) return auth.response;

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  const { data: product, error: lookupError } = await auth.supabase
    .from("products")
    .select("id, image_url")
    .eq("id", id)
    .eq("seller_id", auth.user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("Seller product lookup before deletion failed", lookupError);
    return Response.json({ error: "We couldn't remove that product." }, { status: 500 });
  }
  if (!product) return Response.json({ error: "Product not found." }, { status: 404 });

  const { error: deleteError } = await auth.supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("seller_id", auth.user.id);

  if (deleteError) {
    console.error("Seller product deletion failed", deleteError);
    return Response.json({ error: "We couldn't remove that product." }, { status: 500 });
  }

  invalidateApprovedProductCatalog();

  const storageMarker = "/storage/v1/object/public/products/";
  const imagePath = product.image_url.includes(storageMarker)
    ? product.image_url.split(storageMarker)[1]
    : null;
  if (imagePath) {
    const { error: storageError } = await auth.supabase.storage
      .from("products")
      .remove([decodeURIComponent(imagePath)]);
    if (storageError) {
      console.error("Unable to remove deleted seller product image", storageError);
      return Response.json({
        productId: id,
        warning: "The product was removed, but its image could not be cleaned up.",
      });
    }
  }

  return Response.json({ productId: id });
}
