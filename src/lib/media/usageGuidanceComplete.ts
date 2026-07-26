/**
 * T05 — Complete usage guidance metadata + honest fallback states.
 * Never invents amount / order / frequency / cautions / patch-test / video.
 */

import {
  decideUsageMediaPublication,
  validateUsageInstruction,
  type UsageInstruction,
  type UsageMediaAsset,
} from "@/lib/media/productUsageMediaPolicy";

export type PatchTestGuidance = {
  recommended: boolean;
  waitHours: number | null;
  steps: string[];
  sourceUrl: string | null;
  verifiedAt: string | null;
};

export type ApplicationVideoRef = {
  mediaId: string | null;
  sourceUrl: string | null;
  locale: string | null;
  publishable: boolean;
  reasonCodes: string[];
};

export type UsageGuidanceComplete = UsageInstruction & {
  locale: string;
  countryCode: string | null;
  cautions: string[];
  patchTest: PatchTestGuidance | null;
  applicationVideo: ApplicationVideoRef | null;
};

export type UsageGuidanceFallbackState =
  | "complete"
  | "partial_text_only"
  | "missing_patch_test"
  | "missing_application_video"
  | "media_unavailable"
  | "empty";

export type UsageGuidancePresentation = {
  guidance: UsageGuidanceComplete | null;
  fallbackState: UsageGuidanceFallbackState;
  missingFields: string[];
  /** UI may show text guide even when video/patch-test absent. */
  textGuideEligible: boolean;
  videoEligible: boolean;
  patchTestEligible: boolean;
  localeFallbackApplied: boolean;
  messageKey:
    | "ok"
    | "guide_unavailable"
    | "video_unavailable_keep_text"
    | "patch_test_unavailable_keep_text"
    | "partial_guide";
};

function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validatePatchTestGuidance(
  patch: PatchTestGuidance | null | undefined,
): string[] {
  if (!patch) return ["patch_test_missing"];
  const reasons: string[] = [];
  if (patch.recommended && patch.steps.length === 0) {
    reasons.push("patch_test_steps_missing");
  }
  if (patch.recommended && (patch.waitHours === null || patch.waitHours < 0)) {
    reasons.push("patch_test_wait_invalid");
  }
  if (patch.sourceUrl && !isHttpsUrl(patch.sourceUrl)) {
    reasons.push("patch_test_source_insecure");
  }
  if (patch.verifiedAt) {
    const t = new Date(patch.verifiedAt).getTime();
    if (Number.isNaN(t)) reasons.push("patch_test_verified_at_invalid");
  } else if (patch.recommended) {
    reasons.push("patch_test_unverified");
  }
  return reasons;
}

export function resolveApplicationVideo(
  asset: UsageMediaAsset | null | undefined,
  now = new Date(),
): ApplicationVideoRef {
  if (!asset) {
    return {
      mediaId: null,
      sourceUrl: null,
      locale: null,
      publishable: false,
      reasonCodes: ["application_video_missing"],
    };
  }

  const reasons: string[] = [];
  const decision = decideUsageMediaPublication(asset, now);
  reasons.push(...decision.reasonCodes);

  if (asset.mediaType !== "video" && asset.mediaType !== "animation") {
    reasons.push("application_media_not_video");
  }
  if (!isHttpsUrl(asset.sourceUrl) && !asset.storagePath) {
    reasons.push("application_video_source_insecure");
  }

  const publishable = reasons.length === 0;
  return {
    mediaId: asset.id,
    sourceUrl: publishable ? asset.sourceUrl : null,
    locale: asset.locale || null,
    publishable,
    reasonCodes: [...new Set(reasons)],
  };
}

export function buildUsageGuidanceComplete(input: {
  instruction: UsageInstruction;
  locale: string;
  countryCode?: string | null;
  patchTest?: PatchTestGuidance | null;
  applicationVideoAsset?: UsageMediaAsset | null;
  now?: Date;
}): UsageGuidanceComplete {
  const video = resolveApplicationVideo(
    input.applicationVideoAsset ?? null,
    input.now ?? new Date(),
  );
  return {
    ...input.instruction,
    locale: input.locale.trim() || "en",
    countryCode: input.countryCode?.trim().toUpperCase() || null,
    cautions: [...input.instruction.cautionText],
    patchTest: input.patchTest ?? null,
    applicationVideo: video,
  };
}

export function presentUsageGuidance(
  guidance: UsageGuidanceComplete | null,
  options?: {
    preferredLocale?: string | null;
    fallbackLocale?: string | null;
  },
): UsageGuidancePresentation {
  if (!guidance) {
    return {
      guidance: null,
      fallbackState: "empty",
      missingFields: [
        "amount",
        "order",
        "frequency",
        "cautions",
        "patch_test",
        "application_video",
      ],
      textGuideEligible: false,
      videoEligible: false,
      patchTestEligible: false,
      localeFallbackApplied: false,
      messageKey: "guide_unavailable",
    };
  }

  const preferred = options?.preferredLocale?.trim().toLowerCase() || null;
  const fallbackLocale = options?.fallbackLocale?.trim().toLowerCase() || "en";
  const localeFallbackApplied = Boolean(
    preferred &&
      guidance.locale.toLowerCase() !== preferred &&
      guidance.locale.toLowerCase() === fallbackLocale,
  );

  const instructionReasons = validateUsageInstruction(guidance);
  const missingFields: string[] = [];
  if (instructionReasons.includes("amount_missing")) missingFields.push("amount");
  if (instructionReasons.includes("invalid_order_index")) missingFields.push("order");
  if (!guidance.frequency) missingFields.push("frequency");
  if (guidance.cautions.length === 0 && guidance.cautionText.length === 0) {
    missingFields.push("cautions");
  }

  const patchReasons = validatePatchTestGuidance(guidance.patchTest);
  const patchTestEligible = patchReasons.length === 0;
  if (!patchTestEligible) missingFields.push("patch_test");

  const video = guidance.applicationVideo;
  const videoEligible = Boolean(video?.publishable && video.sourceUrl);
  if (!videoEligible) missingFields.push("application_video");

  const textGuideEligible = instructionReasons.length === 0;
  if (!textGuideEligible) {
    return {
      guidance,
      fallbackState: "empty",
      missingFields: [...new Set([...missingFields, ...instructionReasons])],
      textGuideEligible: false,
      videoEligible: false,
      patchTestEligible: false,
      localeFallbackApplied,
      messageKey: "guide_unavailable",
    };
  }

  if (!videoEligible && !patchTestEligible) {
    return {
      guidance,
      fallbackState: "partial_text_only",
      missingFields,
      textGuideEligible: true,
      videoEligible: false,
      patchTestEligible: false,
      localeFallbackApplied,
      messageKey: "partial_guide",
    };
  }
  if (!videoEligible) {
    return {
      guidance,
      fallbackState: video ? "media_unavailable" : "missing_application_video",
      missingFields,
      textGuideEligible: true,
      videoEligible: false,
      patchTestEligible,
      localeFallbackApplied,
      messageKey: "video_unavailable_keep_text",
    };
  }
  if (!patchTestEligible) {
    return {
      guidance,
      fallbackState: "missing_patch_test",
      missingFields,
      textGuideEligible: true,
      videoEligible: true,
      patchTestEligible: false,
      localeFallbackApplied,
      messageKey: "patch_test_unavailable_keep_text",
    };
  }

  return {
    guidance,
    fallbackState: "complete",
    missingFields: [],
    textGuideEligible: true,
    videoEligible: true,
    patchTestEligible: true,
    localeFallbackApplied,
    messageKey: "ok",
  };
}

export const USAGE_GUIDANCE_FALLBACK_COPY = {
  ko: {
    guide_unavailable: "검증된 사용 가이드가 아직 없습니다.",
    video_unavailable_keep_text:
      "사용 영상은 아직 확인할 수 없습니다. 아래 텍스트 가이드를 참고하세요.",
    patch_test_unavailable_keep_text:
      "패치 테스트 안내는 아직 없습니다. 민감 피부는 소량부터 사용하세요.",
    partial_guide:
      "일부 사용 정보만 검증되었습니다. 확인된 항목만 표시합니다.",
    ok: "",
    patchTest: "패치 테스트",
    patchTestWait: "대기 시간",
    hours: "시간",
  },
  ja: {
    guide_unavailable: "確認済みの使用ガイドはまだありません。",
    video_unavailable_keep_text:
      "使用動画はまだ確認できません。下記のテキストガイドをご覧ください。",
    patch_test_unavailable_keep_text:
      "パッチテスト案内はまだありません。敏感な方は少量からお試しください。",
    partial_guide: "一部の使用情報のみ確認済みです。確認済み項目のみ表示します。",
    ok: "",
    patchTest: "パッチテスト",
    patchTestWait: "待機時間",
    hours: "時間",
  },
  en: {
    guide_unavailable: "No verified usage guide is available yet.",
    video_unavailable_keep_text:
      "Application video is not available yet. Follow the text guide below.",
    patch_test_unavailable_keep_text:
      "Patch-test guidance is not available yet. Start with a small amount if sensitive.",
    partial_guide: "Only partially verified usage details are shown.",
    ok: "",
    patchTest: "Patch test",
    patchTestWait: "Wait time",
    hours: "hours",
  },
} as const;

export type UsageGuidanceCopyLocale = keyof typeof USAGE_GUIDANCE_FALLBACK_COPY;
