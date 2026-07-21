const JPEG_SOI = 0xffd8;
const JPEG_EOI = 0xffd9;
const APP1_MARKER = 0xffe1;

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && readUint16BE(bytes, 0) === JPEG_SOI;
}

function segmentLength(bytes: Uint8Array, offset: number): number {
  if (offset + 3 >= bytes.length) return 0;
  return readUint16BE(bytes, offset + 2);
}

function isExifApp1Segment(bytes: Uint8Array, offset: number): boolean {
  if (readUint16BE(bytes, offset) !== APP1_MARKER) return false;
  const len = segmentLength(bytes, offset);
  if (len < 8 || offset + 4 + 6 > bytes.length) return false;
  const header = String.fromCharCode(
    bytes[offset + 4]!,
    bytes[offset + 5]!,
    bytes[offset + 6]!,
    bytes[offset + 7]!
  );
  return header === "Exif";
}

/** Remove APP1 EXIF segments from JPEG; non-JPEG input is copied unchanged. */
export function stripJpegExif(input: Uint8Array): Uint8Array {
  if (!isJpeg(input)) return new Uint8Array(input);

  const out: number[] = [0xff, 0xd8];
  let i = 2;

  while (i + 3 < input.length) {
    if (input[i] !== 0xff) break;
    const marker = readUint16BE(input, i);
    if (marker === JPEG_EOI) {
      out.push(0xff, 0xd9);
      return new Uint8Array(out);
    }

    const len = segmentLength(input, i);
    if (len < 2) break;

    if (!isExifApp1Segment(input, i)) {
      for (let j = i; j < i + 2 + len && j < input.length; j++) {
        out.push(input[j]!);
      }
    }
    i += 2 + len;
  }

  for (; i < input.length; i++) out.push(input[i]!);
  return new Uint8Array(out);
}

export function jpegContainsExif(input: Uint8Array): boolean {
  if (!isJpeg(input)) return false;
  let i = 2;
  while (i + 3 < input.length) {
    if (input[i] !== 0xff) break;
    if (isExifApp1Segment(input, i)) return true;
    const len = segmentLength(input, i);
    if (len < 2) break;
    i += 2 + len;
  }
  return false;
}

export function stripImageExifBestEffort(
  bytes: Uint8Array,
  mime: string
): { bytes: Uint8Array; stripped: boolean } {
  const normalized = mime.trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    const strippedBytes = stripJpegExif(bytes);
    return {
      bytes: strippedBytes,
      stripped:
        strippedBytes.length !== bytes.length || !jpegContainsExif(strippedBytes),
    };
  }
  return { bytes: new Uint8Array(bytes), stripped: false };
}
