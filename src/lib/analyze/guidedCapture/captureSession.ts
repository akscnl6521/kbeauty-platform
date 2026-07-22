/**
 * Capture session state machine — pure transitions for selftests.
 */

import {
  CAPTURE_ANGLE_ORDER,
  type CaptureAngle,
  type CaptureFlowState,
  type CapturedShot,
  type CaptureSession,
} from "./types";

export function createEmptyCaptureSession(
  overrides?: Partial<CaptureSession>
): CaptureSession {
  return {
    state: "idle",
    shots: {},
    failedAngle: null,
    requestId: null,
    activeFacingMode: "user",
    ...overrides,
  };
}

export function angleIndex(angle: CaptureAngle): number {
  return CAPTURE_ANGLE_ORDER.indexOf(angle);
}

export function capturingStateFor(angle: CaptureAngle): CaptureFlowState {
  switch (angle) {
    case "front":
      return "capturing_front";
    case "left45":
      return "capturing_left";
    case "right45":
      return "capturing_right";
  }
}

export function reviewingStateFor(angle: CaptureAngle): CaptureFlowState {
  switch (angle) {
    case "front":
      return "reviewing_front";
    case "left45":
      return "reviewing_left";
    case "right45":
      return "reviewing_right";
  }
}

export function angleFromCapturingState(
  state: CaptureFlowState
): CaptureAngle | null {
  if (state === "capturing_front" || state === "reviewing_front") return "front";
  if (state === "capturing_left" || state === "reviewing_left") return "left45";
  if (state === "capturing_right" || state === "reviewing_right")
    return "right45";
  if (state === "quality_failed") return null;
  return null;
}

export function nextAngleAfter(angle: CaptureAngle): CaptureAngle | null {
  const i = angleIndex(angle);
  if (i < 0 || i >= CAPTURE_ANGLE_ORDER.length - 1) return null;
  return CAPTURE_ANGLE_ORDER[i + 1]!;
}

export function beginCameraRequest(session: CaptureSession): CaptureSession {
  return { ...session, state: "requesting_permission", failedAngle: null };
}

export function applyPermissionDenied(session: CaptureSession): CaptureSession {
  return { ...session, state: "permission_denied" };
}

export function applyCameraUnavailable(session: CaptureSession): CaptureSession {
  return { ...session, state: "camera_unavailable" };
}

export function applyCameraStartFailed(session: CaptureSession): CaptureSession {
  return { ...session, state: "camera_start_failed" };
}

export function applyVideoPlayFailed(session: CaptureSession): CaptureSession {
  return { ...session, state: "video_play_failed" };
}

export function startCapturing(
  session: CaptureSession,
  angle: CaptureAngle = "front"
): CaptureSession {
  return {
    ...session,
    state: capturingStateFor(angle),
    failedAngle: null,
  };
}

/** Keep requesting_permission until live preview is confirmed. */
export function beginPermissionRequest(
  session: CaptureSession = createEmptyCaptureSession()
): CaptureSession {
  return beginCameraRequest(session);
}

export function acceptShot(
  session: CaptureSession,
  shot: CapturedShot
): CaptureSession {
  const shots = { ...session.shots, [shot.angle]: shot };
  if (shot.qualityStatus === "fail") {
    return {
      ...session,
      shots,
      state: "quality_failed",
      failedAngle: shot.angle,
    };
  }
  return {
    ...session,
    shots,
    state: reviewingStateFor(shot.angle),
    failedAngle: null,
  };
}

/** Advance from review to next capture or ready. */
export function confirmReview(
  session: CaptureSession,
  angle: CaptureAngle
): CaptureSession {
  const shot = session.shots[angle];
  if (!shot || shot.qualityStatus !== "pass") {
    return {
      ...session,
      state: "quality_failed",
      failedAngle: angle,
    };
  }
  const next = nextAngleAfter(angle);
  if (!next) {
    return { ...session, state: "ready_for_analysis", failedAngle: null };
  }
  return {
    ...session,
    state: capturingStateFor(next),
    failedAngle: null,
  };
}

/** Retake only the failed / selected angle — keep other shots. */
export function retakeAngle(
  session: CaptureSession,
  angle: CaptureAngle
): CaptureSession {
  const shots = { ...session.shots };
  delete shots[angle];
  return {
    ...session,
    shots,
    state: capturingStateFor(angle),
    failedAngle: null,
  };
}

export function cancelSession(session: CaptureSession): CaptureSession {
  return { ...session, state: "canceled", failedAngle: null };
}

export function allRequiredShotsPassed(session: CaptureSession): boolean {
  return CAPTURE_ANGLE_ORDER.every((angle) => {
    const shot = session.shots[angle];
    return !!shot && shot.qualityStatus === "pass";
  });
}

export function primaryShotForAnalysis(
  session: CaptureSession
): CapturedShot | null {
  const front = session.shots.front;
  if (front?.qualityStatus === "pass") return front;
  for (const angle of CAPTURE_ANGLE_ORDER) {
    const shot = session.shots[angle];
    if (shot?.qualityStatus === "pass") return shot;
  }
  return null;
}

export function createRequestId(randomUUID?: () => string): string {
  if (randomUUID) return randomUUID();
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function attachRequestId(
  session: CaptureSession,
  requestId: string
): CaptureSession {
  return { ...session, requestId };
}

export function guidanceForAngle(angle: CaptureAngle): {
  titleKo: string;
  bodyKo: string;
  stepLabel: string;
} {
  const step = angleIndex(angle) + 1;
  const stepLabel = `${step}/3`;
  switch (angle) {
    case "front":
      return {
        titleKo: "정면",
        bodyKo: "얼굴을 가이드 안에 맞추고 정면을 바라봐 주세요.",
        stepLabel,
      };
    case "left45":
      return {
        titleKo: "왼쪽 45도",
        bodyKo: "고개를 왼쪽으로 천천히 돌려 주세요.",
        stepLabel,
      };
    case "right45":
      return {
        titleKo: "오른쪽 45도",
        bodyKo: "고개를 오른쪽으로 천천히 돌려 주세요.",
        stepLabel,
      };
  }
}
