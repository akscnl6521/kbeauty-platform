import "server-only";

import { createHash } from "node:crypto";
import { assertSafePublicHttpsUrl } from "@/lib/admin/import/ssrf";
import { ALLOWED_MIME, MAX_IMAGE_BYTES } from "@/lib/admin/product-bulk/imageZip";

export type FetchedBulkImage =
  | {
      ok: true;
      bytes: Buffer;
      mimeType: string;
      fileName: string;
      hash: string;
    }
  | { ok: false; message: string };

/**
 * Fetch an HTTPS image after SSRF checks. Does not use public URL as canonical.
 */
export async function fetchBulkImageFromUrl(
  rawUrl: string
): Promise<FetchedBulkImage> {
  const safety = await assertSafePublicHttpsUrl(rawUrl);
  if (!safety.ok) {
    return { ok: false, message: "이미지 주소가 안전하지 않거나 올바르지 않습니다." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(safety.normalizedHref, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });
    if (!res.ok) {
      return { ok: false, message: "이미지 주소를 내려받지 못했습니다." };
    }
    const mime = (res.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return {
        ok: false,
        message: "이미지 형식이 jpeg/png/webp/gif가 아닙니다.",
      };
    }
    const ab = await res.arrayBuffer();
    const bytes = Buffer.from(ab);
    if (bytes.length === 0) {
      return { ok: false, message: "이미지 파일이 비어 있습니다." };
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      return { ok: false, message: "이미지 크기가 5MB를 초과합니다." };
    }
    const ext =
      mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : mime === "image/gif"
            ? "gif"
            : "jpg";
    const hash = createHash("sha256").update(bytes).digest("hex");
    return {
      ok: true,
      bytes,
      mimeType: mime,
      fileName: `remote-${hash.slice(0, 12)}.${ext}`,
      hash,
    };
  } catch {
    return { ok: false, message: "이미지 주소를 가져오는 중 오류가 발생했습니다." };
  } finally {
    clearTimeout(timer);
  }
}
