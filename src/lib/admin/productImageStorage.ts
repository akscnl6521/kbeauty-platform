/**
 * Private product-image Storage helpers (bucket + canonical refs).
 * Do not insert into storage.buckets / storage.objects via SQL.
 */
export const PRODUCT_IMAGE_BUCKET = "product-images";

/** Signed URL TTL used at registration time (admin delivery re-signs from canonical). */
export const PRODUCT_IMAGE_SIGNED_TTL_SEC = 60 * 60 * 24 * 7;

/** Stable marker stored in media.canonical_image_url for re-signing private objects. */
export function storageObjectCanonicalRef(objectPath: string): string {
  return `storage://${PRODUCT_IMAGE_BUCKET}/${objectPath.replace(/^\/+/, "")}`;
}

export function parseStorageObjectCanonicalRef(
  canonical: string | null | undefined
): { bucket: string; path: string } | null {
  const raw = String(canonical ?? "").trim();
  const m = raw.match(/^storage:\/\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1]!, path: m[2]! };
}
