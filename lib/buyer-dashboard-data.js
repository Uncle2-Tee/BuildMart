import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";

const CATALOG_CACHE_DURATION_MS = 5 * 60 * 1000;
const CATALOG_ERROR_CACHE_DURATION_MS = 60 * 1000;
const CATALOG_REQUEST_TIMEOUT_MS = 3 * 1000;
let approvedProductCatalog = null;
let catalogExpiresAt = 0;
let catalogRequest = null;
let catalogVersion = 0;

async function loadApprovedProductCatalog() {
  const admin = createSupabaseAdminClient();
  const { data: approvedSellers, error: sellersError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "seller")
    .eq("seller_status", "approved");

  if (sellersError) throw new Error(`Unable to load approved shops: ${sellersError.message}`);
  const sellerIds = (approvedSellers ?? []).map((seller) => seller.id);
  if (!sellerIds.length) return [];

  const { data, error } = await admin
    .from("products")
    .select("id, title, description, category, price_kobo, image_url")
    .eq("active", true)
    .in("seller_id", sellerIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to load the product catalogue: ${error.message}`);
  return data ?? [];
}

export function invalidateApprovedProductCatalog() {
  catalogVersion += 1;
  approvedProductCatalog = null;
  catalogExpiresAt = 0;
}

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Catalogue request timed out.")), CATALOG_REQUEST_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function refreshApprovedProductCatalog() {
  const requestVersion = catalogVersion;
  const request = {
    version: requestVersion,
    promise: withTimeout(loadApprovedProductCatalog())
      .then((products) => {
        const result = { products, catalogError: false };
        if (catalogVersion === requestVersion) {
          approvedProductCatalog = result;
          catalogExpiresAt = Date.now() + CATALOG_CACHE_DURATION_MS;
        }
        return result;
      })
      .catch((error) => {
        console.error("Unable to load approved product catalogue", error);
        const result = {
          products: approvedProductCatalog?.products ?? [],
          catalogError: true,
        };
        if (catalogVersion === requestVersion) {
          approvedProductCatalog = result;
          catalogExpiresAt = Date.now() + CATALOG_ERROR_CACHE_DURATION_MS;
        }
        return result;
      })
      .finally(() => {
        if (catalogRequest === request) catalogRequest = null;
      }),
  };

  catalogRequest = request;
  return request.promise;
}

export async function getApprovedProductCatalog() {
  if (approvedProductCatalog) {
    if (catalogExpiresAt > Date.now()) return approvedProductCatalog;
    if (!catalogRequest || catalogRequest.version !== catalogVersion) {
      void refreshApprovedProductCatalog();
    }
    return approvedProductCatalog;
  }

  if (!catalogRequest || catalogRequest.version !== catalogVersion) {
    return refreshApprovedProductCatalog();
  }

  return catalogRequest.promise;
}
