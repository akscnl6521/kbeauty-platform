import assert from "node:assert/strict";
import {
  jpegContainsExif,
  stripImageExifBestEffort,
  stripJpegExif,
} from "../src/lib/care/media/stripExif";

function ok(cond: unknown, label: string) {
  assert.ok(cond, label);
}

function buildFakeJpegWithExif(): Uint8Array {
  const parts: number[] = [0xff, 0xd8];
  // APP1 EXIF segment
  const exifPayload = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif\0\0
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
  ];
  const segLen = exifPayload.length + 2;
  parts.push(0xff, 0xe1, (segLen >> 8) & 0xff, segLen & 0xff, ...exifPayload);
  // minimal image data
  parts.push(0xff, 0xd9);
  return new Uint8Array(parts);
}

const jpeg = buildFakeJpegWithExif();
ok(jpegContainsExif(jpeg), "contains exif before strip");

const stripped = stripJpegExif(jpeg);
ok(!jpegContainsExif(stripped), "exif removed");
ok(stripped[0] === 0xff && stripped[1] === 0xd8, "still jpeg");

const pngLike = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const pngResult = stripImageExifBestEffort(pngLike, "image/png");
ok(!pngResult.stripped, "png unchanged");
ok(pngResult.bytes.length === pngLike.length, "png copy");

const jpegResult = stripImageExifBestEffort(jpeg, "image/jpeg");
ok(jpegResult.stripped, "jpeg stripped flag");

console.log("[photo-comparison-exif] passed");
