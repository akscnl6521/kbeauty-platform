/**
 * User-facing analyze photo input policy (Master Plan §22).
 * Gallery upload is forbidden on the general user path.
 */

export const USER_FACING_INPUT_SOURCES = [
  "camera",
  "questionnaire_only",
] as const;

export type UserFacingInputSource = (typeof USER_FACING_INPUT_SOURCES)[number];

export function isUserFacingInputSource(
  value: string
): value is UserFacingInputSource {
  return (USER_FACING_INPUT_SOURCES as readonly string[]).includes(value);
}

/** General product UI must never offer gallery upload. */
export function isGalleryAllowedForGeneralUsers(): boolean {
  return false;
}

export const CAMERA_ONLY_POLICY_COPY_KO = {
  currentSkinOnly:
    "지금 촬영한 사진만 사용합니다. 기존·갤러리 사진은 받지 않습니다.",
  noGallery:
    "기존 사진이나 갤러리 사진은 사용하지 않습니다.",
  questionnaireFallback:
    "촬영이 어려우면 사진 없이 문진으로 진행할 수 있습니다.",
  permissionHelp:
    "브라우저 주소창 왼쪽의 자물쇠(또는 사이트 설정)에서 카메라 권한을 허용한 뒤 다시 시도해 주세요.",
} as const;

/**
 * Honest scope copy (WQ-G P0-001): capture ≠ external vision AI.
 * Photos are for local quality / angle standardization; guidance is questionnaire-based.
 */
export const ANALYSIS_SCOPE_COPY_KO = {
  capturePurpose:
    "정면·왼쪽 45°·오른쪽 45° 촬영은 품질·각도 표준화용입니다. 피부 안내는 문진·입력 정보를 기준으로 생성됩니다.",
  noExternalVision:
    "현재 단계에서 사진 픽셀은 외부 AI로 보내지 않습니다.",
  noIdentity:
    "얼굴 신원 확인에는 사용하지 않습니다.",
  noPermanentStoreDefault:
    "비교 저장에 동의하지 않으면 원본은 보관하지 않습니다. 이번 단계에서는 서버에 사진을 영구 저장하지 않으며, 안내 후 이 기기의 임시 미리보기는 정리됩니다.",
  readyAfterThreeShots:
    "3장 촬영을 마쳤습니다. 촬영은 품질·각도 확인용이며, 피부 안내는 문진·입력 정보로 이어집니다.",
  startGuideCta: "피부 가이드 시작",
  startGuideCtaBusy: "안내 준비 중…",
  progressTitle: "피부 가이드 진행",
  consentAnalysisLabel:
    "문진·입력 기반 피부 안내(AI)를 받는 것에 동의합니다. 사진 픽셀은 외부 AI로 보내지 않으며, 촬영은 품질·각도 확인용입니다.",
  consentBlocked:
    "피부 안내를 받으려면 안내 동의가 필요합니다.",
  analysisOnlyDetail:
    "안내가 끝나면 이 기기의 임시 사진은 삭제됩니다. 사진 픽셀은 외부 AI로 보내지 않습니다.",
  analysisOnlyAck:
    "분석만 모드: 안내 완료 후 이 기기의 임시 사진 데이터는 삭제됩니다. 사진 픽셀은 외부 AI로 보내지 않습니다.",
  resultsGuideLabel: "AI 피부 가이드",
  resultsGuideBadge: "AI 가이드 반영됨",
  resultsSubtitle:
    "이 결과는 피부톤, 피부 고민, 언더톤, 가격대와 문진·입력 기반 AI 가이드를 기준으로 정리되었습니다.",
} as const;
