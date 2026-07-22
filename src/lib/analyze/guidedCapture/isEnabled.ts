/**
 * Feature flag for Phase 3.0 guided camera capture.
 * Not a security boundary — rollback only.
 * Default ON when unset; set NEXT_PUBLIC_GUIDED_CAMERA_CAPTURE=0 to disable.
 */
export function isGuidedCameraCaptureEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = (
    env.NEXT_PUBLIC_GUIDED_CAMERA_CAPTURE ?? "1"
  )
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}
