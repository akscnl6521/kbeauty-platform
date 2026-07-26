/**
 * T06 — Final integration release evidence contract.
 * Code/selftest may mark `verified_complete`; Preview/device/policy stay `external_only`.
 */

export type EvidenceClass =
  | "verified_complete"
  | "partial"
  | "external_only"
  | "deferred";

export type JourneyStepId =
  | "home"
  | "analyze_input"
  | "guided_capture_manual"
  | "safety_gate"
  | "results_recommend"
  | "usage_guide"
  | "commerce_lanes"
  | "routine_save"
  | "beauty_profile"
  | "follow_up_checkin"
  | "professional_guidance"
  | "photo_consent_privacy"
  | "disclosure";

export type JourneyStepEvidence = {
  id: JourneyStepId;
  titleKo: string;
  codePaths: string[];
  classification: EvidenceClass;
  notesKo: string;
};

/** Connected user-journey map for release evidence (honest classifications). */
export const FINAL_INTEGRATION_JOURNEY: readonly JourneyStepEvidence[] = [
  {
    id: "home",
    titleKo: "홈 진입",
    codePaths: ["src/app/page.tsx"],
    classification: "verified_complete",
    notesKo: "라우트·브랜드 진입 코드 존재",
  },
  {
    id: "analyze_input",
    titleKo: "분석·문진 입력",
    codePaths: [
      "src/app/analyze/page.tsx",
      "src/lib/analyze/guidedCapture/inputPolicy.ts",
    ],
    classification: "verified_complete",
    notesKo: "갤러리 금지 · 문진/카메라 경로 · 정직한 분석 범위 카피",
  },
  {
    id: "guided_capture_manual",
    titleKo: "수동 3각도 촬영 (기본)",
    codePaths: [
      "src/components/analyze/guidedCapture/GuidedCaptureFlow.tsx",
      "src/lib/analyze/guidedCapture/landmark/isEnabled.ts",
    ],
    classification: "verified_complete",
    notesKo: "Phase 3.0 기본 · landmark 자동촬영 flag 기본 OFF",
  },
  {
    id: "safety_gate",
    titleKo: "위험 신호·추천 중단",
    codePaths: [
      "src/lib/ai/symptomSafety.ts",
      "src/lib/care/professionalGuidanceBundle.ts",
    ],
    classification: "verified_complete",
    notesKo: "professionalRoutes · productRecommendationAllowed=false",
  },
  {
    id: "results_recommend",
    titleKo: "결과·추천 카드",
    codePaths: [
      "src/app/results/page.tsx",
      "src/components/recommendation/RecommendedProductCard.tsx",
    ],
    classification: "partial",
    notesKo: "코드·selftest 연결 · Preview A/B/C 육안은 external",
  },
  {
    id: "usage_guide",
    titleKo: "사용 가이드·패치/영상 fallback",
    codePaths: [
      "src/components/usage/ProductUsageGuide.tsx",
      "src/lib/media/usageGuidanceComplete.ts",
    ],
    classification: "verified_complete",
    notesKo: "빈 상태·disclosure · 재고/가격 미발명",
  },
  {
    id: "commerce_lanes",
    titleKo: "Organic/Affiliate/Sponsored 분리",
    codePaths: [
      "src/lib/commercial/affiliateLink.ts",
      "src/components/commerce/SponsoredCard.tsx",
    ],
    classification: "verified_complete",
    notesKo: "코드 레인 분리 · 실제휴 URL은 external",
  },
  {
    id: "routine_save",
    titleKo: "루틴·결과 저장",
    codePaths: ["src/app/routine/page.tsx", "src/lib/care/local-store.ts"],
    classification: "verified_complete",
    notesKo: "로컬 케어 저장 · 로그인 sync는 환경 의존",
  },
  {
    id: "beauty_profile",
    titleKo: "장기 BeautyProfile",
    codePaths: [
      "src/app/my/profile/page.tsx",
      "src/lib/profile/beautyProfile.ts",
      "src/app/api/care/beauty-profile/route.ts",
    ],
    classification: "partial",
    notesKo: "UI·API·DRAFT · Staging beauty_profiles 미적용",
  },
  {
    id: "follow_up_checkin",
    titleKo: "3/7/15/30 체크인·follow-up",
    codePaths: [
      "src/app/my/check-ins",
      "src/lib/retention/followUpLifecycle.ts",
    ],
    classification: "partial",
    notesKo: "lifecycle·dry-run · 실 email/SMS/push 미연결",
  },
  {
    id: "professional_guidance",
    titleKo: "전문가·병원 안내",
    codePaths: [
      "src/app/my/guidance/page.tsx",
      "src/app/admin/clinics/page.tsx",
    ],
    classification: "partial",
    notesKo: "UI·게이트·fixture · 공식 publishable 병원 0",
  },
  {
    id: "photo_consent_privacy",
    titleKo: "사진 동의·프라이버시",
    codePaths: [
      "src/components/care/PhotoConsentPanel.tsx",
      "src/lib/care/photoComparisonPolicy.ts",
      "src/lib/analyze/guidedCapture/inputPolicy.ts",
    ],
    classification: "verified_complete",
    notesKo: "동의·보관·픽셀 외부 AI 미전송 카피 · Staging Storage는 external",
  },
  {
    id: "disclosure",
    titleKo: "광고·협찬 disclosure",
    codePaths: [
      "src/components/disclosure/ContentDisclosure.tsx",
      "src/lib/media/contentDisclosurePolicy.ts",
    ],
    classification: "verified_complete",
    notesKo: "공용 disclosure 라벨 정책",
  },
] as const;

export type ReleaseGateEvidence = {
  id: string;
  titleKo: string;
  classification: EvidenceClass;
  notesKo: string;
};

export const FINAL_INTEGRATION_GATES: readonly ReleaseGateEvidence[] = [
  {
    id: "landmark_default_off",
    titleKo: "Phase 3.1 자동 landmark 기본 OFF",
    classification: "verified_complete",
    notesKo: "NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE 미설정/0 → false",
  },
  {
    id: "manual_three_angle",
    titleKo: "수동 3각도 기본 UX",
    classification: "verified_complete",
    notesKo: "GuidedCaptureFlow · Phase 3.0",
  },
  {
    id: "preview_visual",
    titleKo: "Preview 육안 (P0-003 / P1-003)",
    classification: "external_only",
    notesKo: "사람 검수 필요 · 에이전트 위장 금지",
  },
  {
    id: "device_visual",
    titleKo: "실기기 Android/iPhone (P1-005)",
    classification: "external_only",
    notesKo: "사람 실기기 검수 필요",
  },
  {
    id: "privacy_legal",
    titleKo: "개인정보 전송 범위 법무 (P1-006)",
    classification: "external_only",
    notesKo: "정책·법무 최종 검수",
  },
  {
    id: "wqg_p0_002",
    titleKo: "Production AI_PROVIDER",
    classification: "external_only",
    notesKo: "RELEASE_GATE_PENDING · 배포 직전만",
  },
  {
    id: "phase31_deferred",
    titleKo: "Phase 3.1 자동 정렬",
    classification: "deferred",
    notesKo: "코드 보존 · Android blocker · flag OFF",
  },
] as const;

export function journeyStepsByClass(
  classification: EvidenceClass
): JourneyStepEvidence[] {
  return FINAL_INTEGRATION_JOURNEY.filter(
    (s) => s.classification === classification
  );
}

export function assertNoExternalMarkedVerified(): void {
  for (const gate of FINAL_INTEGRATION_GATES) {
    if (
      (gate.id === "preview_visual" ||
        gate.id === "device_visual" ||
        gate.id === "privacy_legal" ||
        gate.id === "wqg_p0_002") &&
      gate.classification === "verified_complete"
    ) {
      throw new Error(`gate must stay external_only: ${gate.id}`);
    }
  }
  for (const step of FINAL_INTEGRATION_JOURNEY) {
    if (step.classification === "external_only") {
      throw new Error(
        `journey step ${step.id} should use partial/verified; put Preview gates in FINAL_INTEGRATION_GATES`
      );
    }
  }
}
