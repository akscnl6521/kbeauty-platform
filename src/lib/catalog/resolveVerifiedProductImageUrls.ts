import "server-only";

import {
  parseStorageObjectCanonicalRef,
  PRODUCT_IMAGE_SIGNED_TTL_SEC,
} from "@/lib/admin/productImageStorage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_IDS = 80;

type MediaRow = {
  product_id?: unknown;
  image_url?: unknown;
  canonical_image_url?: unknown;
  is_primary?: unknown;
};

/**
 * Resolve displayable HTTPS image URLs for verified, non-fixture primary media.
 * Re-signs private `storage://product-images/...` canonical refs (service role).
 * Never invents external placeholder images.
 */
export async function resolveVerifiedProductImageUrls(
  productIds: Array<string | number>
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      productIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => /^\d+$/.test(id))
    ),
  ].slice(0, MAX_IDS);

  const out = new Map<string, string>();
  if (ids.length === 0) return out;

  const client = createSupabaseAdminClient();
  const { data: rows, error } = await client
    .from("catalog_product_media")
    .select(
      "product_id, image_url, canonical_image_url, validation_status, is_primary, is_fixture"
    )
    .in("product_id", ids)
    .eq("validation_status", "verified")
    .eq("is_fixture", false)
    .order("is_primary", { ascending: false });

  if (error || !rows?.length) return out;

  const picked = new Map<string, MediaRow>();
  for (const row of rows as MediaRow[]) {
    const pid = String(row.product_id ?? "").trim();
    if (!pid || picked.has(pid)) continue;
    picked.set(pid, row);
  }

  await Promise.all(
    [...picked.entries()].map(async ([pid, row]) => {
      const canonical = String(row.canonical_image_url ?? "").trim();
      const storageRef = parseStorageObjectCanonicalRef(canonical);
      if (storageRef) {
        const { data: signed } = await client.storage
          .from(storageRef.bucket)
          .createSignedUrl(storageRef.path, PRODUCT_IMAGE_SIGNED_TTL_SEC);
        if (signed?.signedUrl?.startsWith("https://")) {
          out.set(pid, signed.signedUrl);
          return;
        }
      }

      const existing = String(row.image_url ?? "").trim();
      if (existing.startsWith("https://")) {
        out.set(pid, existing);
      }
    })
  );

  return out;
}
