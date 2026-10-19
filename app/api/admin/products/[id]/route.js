import { getApiRole } from "../../../../../lib/auth";
import { invalidateApprovedProductCatalog } from "../../../../../lib/buyer-dashboard-data";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "../../../../../lib/supabase/admin";
import { isSameOriginRequest } from "../../../../../lib/request-origin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizeAdmin(request, id) {
  if (!isSameOriginRequest(request)) {
    return { response: Response.json({ error: "Request origin is not allowed." }, { status: 403 }) };
  }

  const auth = await getApiRole(["admin"]);
  if (auth.response) return auth;
  if (!isSupabaseAdminConfigured()) {
    return { response: Response.json({ error: "Administrator operations are not configured." }, { status: 503 }) };
  }
  if (!uuidPattern.test(id)) {
    return { response: Response.json({ error: "Product not found." }, { status: 404 }) };
  }

  return { admin: createSupabaseAdminClient() };
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const auth = await authorizeAdmin(request, id);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Product update must contain valid JSON." }, { status: 400 });
  }
  if (!body || typeof body.active !== "boolean") {
    return Response.json({ error: "Product visibility must be enabled or disabled." }, { status: 400 });
  }

  const { data: product, error } = await auth.admin
    .from("products")
    .update({ active: body.active })
    .eq("id", id)
    .select("id, active")
    .maybeSingle();
  if (error) {
    console.error("Administrator product visibility update failed", error);
    return Response.json({ error: "We couldn't update this product." }, { status: 500 });
  }
  if (!product) return Response.json({ error: "Product not found." }, { status: 404 });

  invalidateApprovedProductCatalog();
  return Response.json({ product });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const auth = await authorizeAdmin(request, id);
  if (auth.response) return auth.response;

  const { data: product, error: lookupError } = await auth.admin
    .from("products")
    .select("id, image_url")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) {
    console.error("Administrator product lookup before deletion failed", lookupError);
    return Response.json({ error: "We couldn't remove this product." }, { status: 500 });
  }
  if (!product) return Response.json({ error: "Product not found." }, { status: 404 });

  const { error: deleteError } = await auth.admin
    .from("products")
    .delete()
    .eq("id", id);
  if (deleteError) {
    console.error("Administrator product deletion failed", deleteError);
    return Response.json({ error: "We couldn't remove this product." }, { status: 500 });
  }

  invalidateApprovedProductCatalog();

  const marker = "/storage/v1/object/public/products/";
  let imagePath = null;
  try {
    const pathname = new URL(product.image_url).pathname;
    if (pathname.includes(marker)) {
      imagePath = decodeURIComponent(pathname.split(marker)[1]);
    }
  } catch {
    console.error("Deleted product contained an invalid image URL", { productId: id });
  }

  if (imagePath) {
    const { error: storageError } = await auth.admin.storage.from("products").remove([imagePath]);
    if (storageError) {
      console.error("Unable to remove deleted product image", storageError);
      return Response.json({
        productId: id,
        warning: "The product was removed, but its image could not be cleaned up.",
      });
    }
  }

  return Response.json({ productId: id });
}
