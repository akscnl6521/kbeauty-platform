/**
 * MediaPipe FaceLandmarker client — local WASM/model only.
 * Validates raw landmarks; display transform once; never caches invalid data.
 */

"use client";

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  FACE_LANDMARKER_MODEL_PATH,
  FACE_LANDMARKER_WASM_PATH,
  LANDMARK_SLOW_MS,
} from "./isEnabled";
import {
  boundsCenter,
  computeCoverTransform,
  readVideoDisplayMetrics,
  videoBoundsToDisplayBounds,
  videoNormToDisplayNorm,
  type CoverTransform,
  type VideoDisplayMetrics,
} from "./displaySpace";
import {
  buildFaceBoundsFromLandmarks,
  formatDiagNum,
  readLandmarkXY,
  sanitizePoseDeg,
  validateDisplayBounds,
  validateDisplayPoint,
} from "./landmarkSanity";
import { copyMatrix4Data, eulerFromColumnMajor4x4, LM, midpoint } from "./poseMath";
import type { LandmarkSnapshot, NormPoint } from "./types";
import { logCameraDiagnostic } from "../cameraDiagnostics";

export type FaceLandmarkerLoadResult =
  | { ok: true; loadMs: number }
  | { ok: false; reason: string; loadMs: number };

export type CoordinateTrace = {
  rawC: string;
  rawBounds: string;
  preMirrorC: string;
  displayC: string;
  invalidStage: string | null;
};

export type DetectOutcome =
  | {
      status: "ok";
      snapshot: LandmarkSnapshot;
      metrics: VideoDisplayMetrics;
      cover: CoverTransform;
      trace: CoordinateTrace;
      poseReliable: boolean;
    }
  | {
      status: "skipped";
      reason: "in_flight" | "not_ready" | "throttled" | "disposed";
    }
  | {
      status: "transform_error";
      reason: string;
      metrics: VideoDisplayMetrics;
    }
  | {
      status: "invalid_landmark_data";
      reason: string;
      invalidStage: string;
      metrics: VideoDisplayMetrics;
      cover: CoverTransform | null;
      trace: CoordinateTrace;
    }
  | {
      status: "inference_error";
      reason: string;
    };

function emptyTrace(stage: string | null = null): CoordinateTrace {
  return {
    rawC: "-",
    rawBounds: "-",
    preMirrorC: "-",
    displayC: "-",
    invalidStage: stage,
  };
}

export class FaceLandmarkerSession {
  private landmarker: FaceLandmarker | null = null;
  private lastInferAtMs = 0;
  private lastMediaPipeTs = 0;
  private inferInFlight = false;
  private inferenceCount = 0;
  private lastInferenceAt: number | null = null;
  private lastInferenceError: string | null = null;
  disposed = false;
  lastMetrics: VideoDisplayMetrics | null = null;
  lastCover: CoverTransform | null = null;
  lastTrace: CoordinateTrace = emptyTrace();
  restartCount = 0;

  get lockState() {
    return this.inferInFlight;
  }

  get stats() {
    return {
      inferenceCount: this.inferenceCount,
      lastInferenceAt: this.lastInferenceAt,
      inferenceError: this.lastInferenceError,
      lockState: this.inferInFlight,
      detectorRestartCount: this.restartCount,
    };
  }

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
      this.lastMediaPipeTs = 0;
      this.inferInFlight = false;
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
        this.lastMediaPipeTs = 0;
        this.inferInFlight = false;
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

  /** Soft reset between frames — clears lock/timestamp without tearing down WASM. */
  softReset() {
    this.inferInFlight = false;
    this.lastMediaPipeTs = 0;
    this.lastInferenceError = null;
  }

  async hardRestart(): Promise<boolean> {
    this.restartCount += 1;
    try {
      this.landmarker?.close();
    } catch {
      // ignore
    }
    this.landmarker = null;
    this.disposed = false;
    this.softReset();
    const loaded = await this.load();
    return loaded.ok;
  }

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
      let ts = opts.nowMs;
      if (!(ts > this.lastMediaPipeTs)) {
        ts = this.lastMediaPipeTs + 1;
      }
      this.lastMediaPipeTs = ts;

      const result = this.landmarker.detectForVideo(video, ts);
      const duration = Math.round(performance.now() - t0);
      this.inferenceCount += 1;
      this.lastInferenceAt = opts.nowMs;
      this.lastInferenceError = null;

      const faces = result.faceLandmarks ?? [];
      if (faces.length === 0) {
        const trace = emptyTrace();
        this.lastTrace = trace;
        return {
          status: "ok",
          metrics,
          cover,
          trace,
          poseReliable: false,
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
      // Stage A — raw landmarks (copied primitives only)
      const rawLeft = midpoint(
        readLandmarkXY(lm, LM.leftEyeOuter),
        readLandmarkXY(lm, LM.leftEyeInner)
      );
      const rawRight = midpoint(
        readLandmarkXY(lm, LM.rightEyeOuter),
        readLandmarkXY(lm, LM.rightEyeInner)
      );
      const rawNose = readLandmarkXY(lm, LM.noseTip);
      const rawMouth = midpoint(
        readLandmarkXY(lm, LM.mouthUpper),
        readLandmarkXY(lm, LM.mouthLower)
      );
      const rawChin = readLandmarkXY(lm, LM.chin);

      const boundsBuild = buildFaceBoundsFromLandmarks(lm);
      if (!boundsBuild.ok) {
        const trace = emptyTrace("raw_bounds");
        this.lastTrace = trace;
        return {
          status: "invalid_landmark_data",
          reason: boundsBuild.reason,
          invalidStage: "raw_bounds",
          metrics,
          cover,
          trace,
        };
      }
      const videoBounds = boundsBuild.bounds;
      const rawCenter = boundsCenter(videoBounds);
      const trace: CoordinateTrace = {
        rawC: `${formatDiagNum(rawCenter.x)},${formatDiagNum(rawCenter.y)}`,
        rawBounds: `${formatDiagNum(videoBounds.xMin)}-${formatDiagNum(videoBounds.xMax)},${formatDiagNum(videoBounds.yMin)}-${formatDiagNum(videoBounds.yMax)}`,
        preMirrorC: "-",
        displayC: "-",
        invalidStage: null,
      };

      // Pose from matrix copy only — never mix into bounds.
      let yaw: number | null = null;
      let pitch: number | null = null;
      let roll: number | null = null;
      let poseReliable = false;
      const matrices = result.facialTransformationMatrixes;
      if (matrices && matrices[0]) {
        const data = copyMatrix4Data(matrices[0]);
        if (data) {
          const e = eulerFromColumnMajor4x4(data);
          if (e) {
            let y = e.yaw;
            if (opts.mirrorX) y = -y;
            const sanitized = sanitizePoseDeg({
              yaw: y,
              pitch: e.pitch,
              roll: e.roll,
            });
            yaw = sanitized.yaw;
            pitch = sanitized.pitch;
            roll = sanitized.roll;
            poseReliable = sanitized.poseReliable;
          }
        }
      }

      // Stage C — display before mirror (mirrorApplyCount temporarily 0)
      const coverNoMirror: CoverTransform = {
        ...cover,
        mirrored: false,
        mirrorApplyCount: 0,
      };
      const preMirrorBounds = videoBoundsToDisplayBounds(
        videoBounds,
        { ...metrics, mirrorX: false },
        coverNoMirror
      );
      if (!preMirrorBounds || !validateDisplayBounds(preMirrorBounds)) {
        trace.invalidStage = "pre_mirror_display";
        this.lastTrace = trace;
        return {
          status: "invalid_landmark_data",
          reason: "pre_mirror_display_invalid",
          invalidStage: "pre_mirror_display",
          metrics,
          cover,
          trace,
        };
      }
      const preC = boundsCenter(preMirrorBounds);
      trace.preMirrorC = `${formatDiagNum(preC.x)},${formatDiagNum(preC.y)}`;

      // Stage D — display with single mirror
      const displayBounds = videoBoundsToDisplayBounds(videoBounds, metrics, cover);
      if (!displayBounds || !validateDisplayBounds(displayBounds)) {
        trace.invalidStage = "display_bounds";
        this.lastTrace = trace;
        return {
          status: "invalid_landmark_data",
          reason: "display_bounds_invalid",
          invalidStage: "display_bounds",
          metrics,
          cover,
          trace,
        };
      }
      const dispC = boundsCenter(displayBounds);
      trace.displayC = `${formatDiagNum(dispC.x)},${formatDiagNum(dispC.y)}`;

      const map = (p: NormPoint | null): NormPoint | null => {
        if (!p) return null;
        const out = videoNormToDisplayNorm(p, metrics, cover);
        return validateDisplayPoint(out) ? out : null;
      };

      const mappedSubjectLeft = map(rawLeft);
      const mappedSubjectRight = map(rawRight);
      const leftEyeCenter = opts.mirrorX
        ? mappedSubjectRight
        : mappedSubjectLeft;
      const rightEyeCenter = opts.mirrorX
        ? mappedSubjectLeft
        : mappedSubjectRight;

      this.lastTrace = trace;

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
        trace,
        poseReliable,
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
    } catch (err) {
      this.lastInferenceError =
        err instanceof Error ? err.message.slice(0, 80) : "inference_throw";
      this.softReset();
      return {
        status: "inference_error",
        reason: this.lastInferenceError,
      };
    } finally {
      this.inferInFlight = false;
    }
  }

  close() {
    this.disposed = true;
    this.inferInFlight = false;
    try {
      this.landmarker?.close();
    } catch {
      // ignore
    }
    this.landmarker = null;
  }
}
