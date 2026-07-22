/**
 * Auto-capture countdown state machine (pure).
 * One auto-capture per angle; cancel on alignment loss.
 */

import type {
  AlignmentStatus,
  AutoCaptureMachineState,
  AutoCapturePhase,
} from "./types";

export const COUNTDOWN_STEP_MS = 1000;

export function createAutoCaptureState(): AutoCaptureMachineState {
  return {
    phase: "adjusting",
    alignmentStatus: "no_face",
    countdownDigit: null,
    alignedSinceMs: null,
    lastCaptureAtMs: null,
    capturedForAngle: false,
  };
}

export function resetAutoCaptureForNewAngle(
  prev: AutoCaptureMachineState
): AutoCaptureMachineState {
  return {
    ...createAutoCaptureState(),
    lastCaptureAtMs: prev.lastCaptureAtMs,
  };
}

export type AutoCaptureTickInput = {
  nowMs: number;
  alignmentStatus: AlignmentStatus;
  stableHoldMs: number;
  voiceEnabled?: boolean;
};

export type AutoCaptureTickResult = {
  state: AutoCaptureMachineState;
  /** Fired once when countdown digit changes (3→2→1). */
  speakDigit: 3 | 2 | 1 | null;
  /** Fired once when hold-still message should play. */
  speakHoldStill: boolean;
  /** Trigger shutter exactly once. */
  shouldCapture: boolean;
  /** Cancel speech when countdown/ready aborted. */
  shouldCancelSpeech: boolean;
};

function cancelCountdown(
  state: AutoCaptureMachineState,
  status: AlignmentStatus
): AutoCaptureMachineState {
  return {
    ...state,
    phase: "adjusting",
    alignmentStatus: status,
    countdownDigit: null,
    alignedSinceMs: null,
  };
}

export function tickAutoCapture(
  prev: AutoCaptureMachineState,
  input: AutoCaptureTickInput
): AutoCaptureTickResult {
  if (prev.capturedForAngle || prev.phase === "capturing") {
    return {
      state: { ...prev, alignmentStatus: input.alignmentStatus },
      speakDigit: null,
      speakHoldStill: false,
      shouldCapture: false,
      shouldCancelSpeech: false,
    };
  }

  const aligned = input.alignmentStatus === "aligned";

  if (!aligned) {
    if (prev.phase === "countdown" || prev.phase === "ready") {
      return {
        state: cancelCountdown(prev, input.alignmentStatus),
        speakDigit: null,
        speakHoldStill: false,
        shouldCapture: false,
        shouldCancelSpeech: true,
      };
    }
    return {
      state: {
        ...prev,
        phase: "adjusting",
        alignmentStatus: input.alignmentStatus,
        alignedSinceMs: null,
        countdownDigit: null,
      },
      speakDigit: null,
      speakHoldStill: false,
      shouldCapture: false,
      shouldCancelSpeech: false,
    };
  }

  // aligned
  let speakHoldStill = false;
  let alignedSince = prev.alignedSinceMs;
  if (alignedSince === null) {
    alignedSince = input.nowMs;
    speakHoldStill = true;
  }

  const held = input.nowMs - alignedSince;
  if (held < input.stableHoldMs) {
    return {
      state: {
        ...prev,
        phase: "ready",
        alignmentStatus: "aligned",
        alignedSinceMs: alignedSince,
        countdownDigit: null,
      },
      speakDigit: null,
      speakHoldStill,
      shouldCapture: false,
      shouldCancelSpeech: false,
    };
  }

  const afterHold = held - input.stableHoldMs;
  if (afterHold < COUNTDOWN_STEP_MS) {
    const digit: 3 = 3;
    const changed = prev.countdownDigit !== digit || prev.phase !== "countdown";
    return {
      state: {
        ...prev,
        phase: "countdown",
        alignmentStatus: "aligned",
        alignedSinceMs: alignedSince,
        countdownDigit: digit,
      },
      speakDigit: changed ? digit : null,
      speakHoldStill: false,
      shouldCapture: false,
      shouldCancelSpeech: false,
    };
  }
  if (afterHold < COUNTDOWN_STEP_MS * 2) {
    const digit: 2 = 2;
    const changed = prev.countdownDigit !== digit;
    return {
      state: {
        ...prev,
        phase: "countdown",
        alignmentStatus: "aligned",
        alignedSinceMs: alignedSince,
        countdownDigit: digit,
      },
      speakDigit: changed ? digit : null,
      speakHoldStill: false,
      shouldCapture: false,
      shouldCancelSpeech: false,
    };
  }
  if (afterHold < COUNTDOWN_STEP_MS * 3) {
    const digit: 1 = 1;
    const changed = prev.countdownDigit !== digit;
    return {
      state: {
        ...prev,
        phase: "countdown",
        alignmentStatus: "aligned",
        alignedSinceMs: alignedSince,
        countdownDigit: digit,
      },
      speakDigit: changed ? digit : null,
      speakHoldStill: false,
      shouldCapture: false,
      shouldCancelSpeech: false,
    };
  }

  // Capture once
  return {
    state: {
      ...prev,
      phase: "capturing",
      alignmentStatus: "aligned",
      alignedSinceMs: alignedSince,
      countdownDigit: null,
      capturedForAngle: true,
      lastCaptureAtMs: input.nowMs,
    },
    speakDigit: null,
    speakHoldStill: false,
    shouldCapture: true,
    shouldCancelSpeech: false,
  };
}

export function markCaptureReviewing(
  state: AutoCaptureMachineState,
  ok: boolean
): AutoCaptureMachineState {
  return {
    ...state,
    phase: ok ? "captured" : "quality_failed",
    countdownDigit: null,
  };
}

export function visualStateFromPhase(
  phase: AutoCapturePhase
): "neutral" | "adjusting" | "ready" | "countdown" | "captured" | "error" {
  switch (phase) {
    case "adjusting":
      return "adjusting";
    case "ready":
      return "ready";
    case "countdown":
      return "countdown";
    case "capturing":
    case "captured":
      return "captured";
    case "reviewing":
      return "ready";
    case "quality_failed":
      return "error";
  }
}
