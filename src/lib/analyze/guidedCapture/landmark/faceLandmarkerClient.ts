/**
 * MediaPipe FaceLandmarker client — browser only, local WASM/model.
 * Display transform (cover + mirror) applied exactly once here.
 */

"use client";

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  FACE_LANDMARKER_MODEL_PATH,
  FACE_LANDMARKER_WASM_PATH,
  LANDMARK_SLOW_MS,
} from "./isEnabled";
import {
  computeCoverTransform,
  readVideoDisplayMetrics,
  videoBoundsToDisplayBounds,
  videoNormToDisplayNorm,
  type CoverTransform,
  type VideoDisplayMetrics,
} from "./displaySpace";
import { eulerFromColumnMajor4x4, LM, midpoint } from "./poseMath";
import type { LandmarkSnapshot, NormPoint } from "./types";
import { logCameraDiagnostic } from "../cameraDiagnostics";

export type FaceLandmarkerLoadResult =
  | { ok: true; loadMs: number }
  | { ok: false; reason: string; loadMs: number };

export type DetectOutcome =
  | {
      status: "ok";
      snapshot: LandmarkSnapshot;
      metrics: VideoDisplayMetrics;
      cover: CoverTransform;
    }
  | {
      status: "skipped";
      reason: "in_flight" | "not_ready" | "throttled" | "disposed";
    }
  | {
      status: "transform_error";
      reason: string;
      metrics: VideoDisplayMetrics;
    };

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
): NonNullable<LandmarkSnapshot["videoFaceBounds"]> | null {
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

export class FaceLandmarkerSession {
  private landmarker: FaceLandmarker | null = null;
  private lastInferAtMs = 0;
  private lastMediaPipeTs = -1;
  private inferInFlight = false;
  disposed = false;
  lastMetrics: VideoDisplayMetrics | null = null;
  lastCover: CoverTransform | null = null;

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

  /**
   * Do NOT gate on video.currentTime — Android Chrome often stalls/repeats it,
   * which previously caused perpetual null → fake "no_face/center" messages.
   */
  detect(
    video: HTMLVideoElement,
    opts: { mirrorX: boolean; nowMs: number; minIntervalMs: number }
  ): DetectOutcome {
    if (this.disposed || !this.landmarker) {
      return { status: "skipped", reason: "disposed" };
    }
    if (this.inferInFlight) {
      return { status: "skipped", reason: "in_flight" };
    }
    if (video.readyState < 2) {
      return { status: "skipped", reason: "not_ready" };
    }
    if (opts.nowMs - this.lastInferAtMs < opts.minIntervalMs) {
      return { status: "skipped", reason: "throttled" };
    }

    const metrics = readVideoDisplayMetrics(video, opts.mirrorX);
    this.lastMetrics = metrics;
    const cover = computeCoverTransform(metrics);
    this.lastCover = cover;
    if (!cover.ok) {
      return {
        status: "transform_error",
        reason: "client_or_video_size_invalid",
        metrics,
      };
    }

    this.inferInFlight = true;
    const t0 = performance.now();
    try {
      this.lastInferAtMs = opts.nowMs;
      // MediaPipe requires strictly increasing timestamps.
      let ts = opts.nowMs;
      if (ts <= this.lastMediaPipeTs) ts = this.lastMediaPipeTs + 1;
      this.lastMediaPipeTs = ts;

      const result = this.landmarker.detectForVideo(video, ts);
      const duration = Math.round(performance.now() - t0);
      const faces = result.faceLandmarks ?? [];

      if (faces.length === 0) {
        return {
          status: "ok",
          metrics,
          cover,
          snapshot: {
            faceCount: 0,
            leftEyeCenter: null,
            rightEyeCenter: null,
            noseTip: null,
            mouthCenter: null,
            chinTip: null,
            faceBounds: null,
            videoFaceBounds: null,
            yaw: null,
            pitch: null,
            roll: null,
            detectionConfidence: null,
            inferenceTimestamp: opts.nowMs,
            inferenceDurationMs: duration,
            coordinateSpace: "display",
            videoTime: video.currentTime,
          },
        };
      }

      const lm = faces[0]!;
      const rawSubjectLeft = midpoint(
        pt(lm, LM.leftEyeOuter),
        pt(lm, LM.leftEyeInner)
      );
      const rawSubjectRight = midpoint(
        pt(lm, LM.rightEyeOuter),
        pt(lm, LM.rightEyeInner)
      );
      const rawNose = pt(lm, LM.noseTip) ?? null;
      const rawMouth = midpoint(pt(lm, LM.mouthUpper), pt(lm, LM.mouthLower));
      const rawChin = pt(lm, LM.chin) ?? null;
      const videoBounds = boundsOf(lm);

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
          // Pose convention only (not a second X mirror on landmarks).
          if (opts.mirrorX && yaw !== null) yaw = -yaw;
        }
      }

      const map = (p: NormPoint | null | undefined): NormPoint | null =>
        p ? videoNormToDisplayNorm(p, metrics, cover) : null;

      const displayBounds = videoBounds
        ? videoBoundsToDisplayBounds(videoBounds, metrics, cover)
        : null;

      // Label swap for viewer-left after single display mirror — coords already mirrored once.
      const mappedSubjectLeft = map(rawSubjectLeft);
      const mappedSubjectRight = map(rawSubjectRight);
      const leftEyeCenter = opts.mirrorX
        ? mappedSubjectRight
        : mappedSubjectLeft;
      const rightEyeCenter = opts.mirrorX
        ? mappedSubjectLeft
        : mappedSubjectRight;

      if (duration > LANDMARK_SLOW_MS * 2) {
        logCameraDiagnostic({
          event: "camera_state_changed",
          detail: `inference_slow:${duration}`,
        });
      }

      return {
        status: "ok",
        metrics,
        cover,
        snapshot: {
          faceCount: faces.length,
          leftEyeCenter,
          rightEyeCenter,
          noseTip: map(rawNose),
          mouthCenter: map(rawMouth),
          chinTip: map(rawChin),
          faceBounds: displayBounds,
          videoFaceBounds: videoBounds,
          yaw,
          pitch,
          roll,
          detectionConfidence: null,
          inferenceTimestamp: opts.nowMs,
          inferenceDurationMs: duration,
          coordinateSpace: "display",
          videoTime: video.currentTime,
        },
      };
    } catch {
      return { status: "skipped", reason: "not_ready" };
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
