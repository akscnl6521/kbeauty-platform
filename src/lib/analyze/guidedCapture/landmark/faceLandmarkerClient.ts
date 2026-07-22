/**
 * MediaPipe FaceLandmarker client — browser only, local WASM/model.
 * Does not create identity embeddings or send frames off-device.
 */

"use client";

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  FACE_LANDMARKER_MODEL_PATH,
  FACE_LANDMARKER_WASM_PATH,
  LANDMARK_SLOW_MS,
} from "./isEnabled";
import { eulerFromColumnMajor4x4, LM, midpoint, mirrorNormX } from "./poseMath";
import type { LandmarkSnapshot, NormPoint } from "./types";
import { logCameraDiagnostic } from "../cameraDiagnostics";

export type FaceLandmarkerLoadResult =
  | { ok: true; loadMs: number }
  | { ok: false; reason: string; loadMs: number };

function pt(
  landmarks: Array<{ x: number; y: number }>,
  index: number
): NormPoint | undefined {
  const p = landmarks[index];
  if (!p) return undefined;
  return { x: p.x, y: p.y };
}

function boundsOf(
  landmarks: Array<{ x: number; y: number }>
): LandmarkSnapshot["faceBounds"] {
  if (landmarks.length === 0) return null;
  let xMin = 1;
  let yMin = 1;
  let xMax = 0;
  let yMax = 0;
  for (const p of landmarks) {
    xMin = Math.min(xMin, p.x);
    yMin = Math.min(yMin, p.y);
    xMax = Math.max(xMax, p.x);
    yMax = Math.max(yMax, p.y);
  }
  return { xMin, yMin, xMax, yMax };
}

function mapDisplaySpace(
  p: NormPoint | null | undefined,
  mirrorX: boolean
): NormPoint | null {
  if (!p) return null;
  return mirrorX ? { x: mirrorNormX(p.x), y: p.y } : { x: p.x, y: p.y };
}

export class FaceLandmarkerSession {
  private landmarker: FaceLandmarker | null = null;
  private lastVideoTime = -1;
  private inferInFlight = false;
  disposed = false;

  async load(): Promise<FaceLandmarkerLoadResult> {
    const t0 = performance.now();
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        FACE_LANDMARKER_WASM_PATH
      );
      this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_PATH,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFacialTransformationMatrixes: true,
      });
      const loadMs = Math.round(performance.now() - t0);
      logCameraDiagnostic({
        event: "camera_state_changed",
        detail: `face_landmarker_loaded:${loadMs}ms`,
      });
      return { ok: true, loadMs };
    } catch (err) {
      const loadMs = Math.round(performance.now() - t0);
      // GPU fail → CPU retry once
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(
          FACE_LANDMARKER_WASM_PATH
        );
        this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL_PATH,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 2,
          outputFacialTransformationMatrixes: true,
        });
        const cpuMs = Math.round(performance.now() - t0);
        logCameraDiagnostic({
          event: "camera_state_changed",
          detail: `face_landmarker_loaded_cpu:${cpuMs}ms`,
        });
        return { ok: true, loadMs: cpuMs };
      } catch (err2) {
        logCameraDiagnostic({
          event: "camera_error",
          errorName: "FaceLandmarkerLoadFailed",
          errorMessage:
            err2 instanceof Error
              ? err2.message.slice(0, 120)
              : err instanceof Error
                ? err.message.slice(0, 120)
                : "load_failed",
          detail: `loadMs=${loadMs}`,
        });
        return {
          ok: false,
          reason: "model_or_wasm_load_failed",
          loadMs,
        };
      }
    }
  }

  detect(
    video: HTMLVideoElement,
    opts: { mirrorX: boolean; nowMs: number }
  ): LandmarkSnapshot | null {
    if (this.disposed || !this.landmarker || this.inferInFlight) return null;
    if (video.readyState < 2) return null;
    if (video.currentTime === this.lastVideoTime) return null;

    this.inferInFlight = true;
    const t0 = performance.now();
    try {
      this.lastVideoTime = video.currentTime;
      const result = this.landmarker.detectForVideo(video, opts.nowMs);
      const duration = Math.round(performance.now() - t0);
      const faces = result.faceLandmarks ?? [];
      if (faces.length === 0) {
        return {
          faceCount: 0,
          leftEyeCenter: null,
          rightEyeCenter: null,
          noseTip: null,
          mouthCenter: null,
          chinTip: null,
          faceBounds: null,
          yaw: null,
          pitch: null,
          roll: null,
          detectionConfidence: null,
          inferenceTimestamp: opts.nowMs,
          inferenceDurationMs: duration,
        };
      }

      const lm = faces[0]!;
      const rawLeft = midpoint(pt(lm, LM.leftEyeOuter), pt(lm, LM.leftEyeInner));
      const rawRight = midpoint(
        pt(lm, LM.rightEyeOuter),
        pt(lm, LM.rightEyeInner)
      );
      const rawNose = pt(lm, LM.noseTip) ?? null;
      const rawMouth = midpoint(pt(lm, LM.mouthUpper), pt(lm, LM.mouthLower));
      const rawChin = pt(lm, LM.chin) ?? null;
      const rawBounds = boundsOf(lm);

      let yaw: number | null = null;
      let pitch: number | null = null;
      let roll: number | null = null;
      const matrices = result.facialTransformationMatrixes;
      if (matrices && matrices[0]) {
        const data =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (matrices[0] as any).data ?? matrices[0];
        if (data && data.length >= 16) {
          const e = eulerFromColumnMajor4x4(data);
          yaw = e.yaw;
          pitch = e.pitch;
          roll = e.roll;
          if (opts.mirrorX && yaw !== null) {
            yaw = -yaw;
          }
        }
      }

      const mirror = opts.mirrorX;
      const mappedBounds = rawBounds
        ? {
            xMin: mirror ? mirrorNormX(rawBounds.xMax) : rawBounds.xMin,
            xMax: mirror ? mirrorNormX(rawBounds.xMin) : rawBounds.xMax,
            yMin: rawBounds.yMin,
            yMax: rawBounds.yMax,
          }
        : null;

      if (duration > LANDMARK_SLOW_MS * 2) {
        logCameraDiagnostic({
          event: "camera_state_changed",
          detail: `inference_slow:${duration}`,
        });
      }

      // Display-space: mirror X when front camera preview is CSS-mirrored.
      // Also swap L/R eye labels so "left eye" means viewer's left on screen.
      const leftEyeCenter = mirror
        ? mapDisplaySpace(rawRight, true)
        : mapDisplaySpace(rawLeft, false);
      const rightEyeCenter = mirror
        ? mapDisplaySpace(rawLeft, true)
        : mapDisplaySpace(rawRight, false);

      return {
        faceCount: faces.length,
        leftEyeCenter,
        rightEyeCenter,
        noseTip: mapDisplaySpace(rawNose, mirror),
        mouthCenter: mapDisplaySpace(rawMouth, mirror),
        chinTip: mapDisplaySpace(rawChin, mirror),
        faceBounds: mappedBounds,
        yaw,
        pitch,
        roll,
        detectionConfidence: null,
        inferenceTimestamp: opts.nowMs,
        inferenceDurationMs: duration,
      };
    } catch {
      return null;
    } finally {
      this.inferInFlight = false;
    }
  }

  close() {
    this.disposed = true;
    try {
      this.landmarker?.close();
    } catch {
      // ignore
    }
    this.landmarker = null;
  }
}
