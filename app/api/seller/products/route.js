import { randomUUID } from "node:crypto";
import { getApiRole } from "../../../../lib/auth";
import { invalidateApprovedProductCatalog } from "../../../../lib/buyer-dashboard-data";
import { isSameOriginRequest } from "../../../../lib/request-origin";

const acceptedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const auth = await getApiRole(["seller"], { requireApprovedSeller: true });
  if (auth.response) return auth.response;

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Product details must be submitted as a form." }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const price = String(form.get("price") ?? "").trim();
  const photo = form.get("photo");
  const priceMatch = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.exec(price);
  const priceKobo = priceMatch ? Math.round(Number(price) * 100) : 0;

  if (
    title.length < 3 ||
    title.length > 120 ||
    description.length > 2000 ||
    category.length < 2 ||
    category.length > 60 ||
    !priceMatch ||
    priceKobo < 1 ||
    priceKobo > 1000000000 ||
    !(photo instanceof File) ||
    !acceptedTypes.has(photo.type) ||
    photo.size < 1 ||
    photo.size > 5 * 1024 * 1024
  ) {
    return Response.json(
      { error: "Check the product details. Images must be JPG, PNG or WebP and under 5 MB." },
      { status: 400 },
    );
  }

  const imagePath = `${auth.user.id}/${randomUUID()}.${acceptedTypes.get(photo.type)}`;
  const photoBytes = Buffer.from(await photo.arrayBuffer());
  const hasImageSignature =
    (photo.type === "image/jpeg" &&
      photoBytes[0] === 0xff &&
      photoBytes[1] === 0xd8 &&
      photoBytes[2] === 0xff) ||
    (photo.type === "image/png" &&
      photoBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (photo.type === "image/webp" &&
      photoBytes.toString("ascii", 0, 4) === "RIFF" &&
      photoBytes.toString("ascii", 8, 12) === "WEBP");

  if (!hasImageSignature) {
    return Response.json({ error: "That file is not a valid JPG, PNG or WebP image." }, { status: 400 });
  }

  const { error: uploadError } = await auth.supabase.storage
    .from("products")
    .upload(imagePath, photoBytes, {
      contentType: photo.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Seller product image upload failed", uploadError);
    return Response.json({ error: "We couldn't upload that image. Please try again." }, { status: 500 });
  }

  const { data: imageData } = auth.supabase.storage
    .from("products")
    .getPublicUrl(imagePath);
  const { data: product, error: productError } = await auth.supabase
    .from("products")
    .insert({
      seller_id: auth.user.id,
      title,
      description,
      category,
      price_kobo: priceKobo,
      image_url: imageData.publicUrl,
      active: true,
    })
    .select("id, title, description, category, price_kobo, image_url, active, created_at")
    .single();

  if (productError) {
    console.error("Seller product creation failed", productError);
    const { error: cleanupError } = await auth.supabase.storage
      .from("products")
      .remove([imagePath]);
    if (cleanupError) console.error("Unable to remove orphaned product image", cleanupError);
    return Response.json({ error: "We couldn't save that product. Please try again." }, { status: 500 });
  }

  invalidateApprovedProductCatalog();
  return Response.json({ product }, { status: 201 });
}
