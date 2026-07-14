import "server-only";

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { AdminConfigurationError } from "@/lib/auth/errors";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type BulkZipImage = {
  fileName: string;
  baseName: string;
  bytes: Buffer;
  mimeType: string;
  hash: string;
};

function mimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return null;
}

/**
 * Extract image files from a ZIP (flat or nested). Rejects invalid MIME/size.
 */
export async function extractImagesFromZip(
  zipBytes: Buffer
): Promise<Map<string, BulkZipImage>> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBytes);
  } catch {
    throw new AdminConfigurationError("ZIP 파일을 열 수 없습니다.");
  }

  const map = new Map<string, BulkZipImage>();
  const entries = Object.values(zip.files);

  for (const entry of entries) {
    if (entry.dir) continue;
    const parts = entry.name.split(/[/\\]/);
    const fileName = parts[parts.length - 1] || "";
    if (!fileName || fileName.startsWith(".")) continue;
    const mime = mimeFromName(fileName);
    if (!mime || !ALLOWED_MIME.has(mime)) continue;

    const buf = Buffer.from(await entry.async("uint8array"));
    if (buf.length === 0) continue;
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new AdminConfigurationError(
        `이미지 "${fileName}"이(가) 5MB를 초과합니다.`
      );
    }

    const hash = createHash("sha256").update(buf).digest("hex");
    const baseName = fileName.toLowerCase();
    const image: BulkZipImage = {
      fileName,
      baseName,
      bytes: buf,
      mimeType: mime,
      hash,
    };
    map.set(baseName, image);
    map.set(fileName, image);
  }

  return map;
}

export { MAX_IMAGE_BYTES, ALLOWED_MIME };
