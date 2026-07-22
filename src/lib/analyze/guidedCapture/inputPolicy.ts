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
    "현재 피부 상태를 정확히 보기 위해 지금 촬영한 사진만 사용합니다.",
  noGallery:
    "기존 사진이나 갤러리 사진은 분석에 사용하지 않습니다.",
  questionnaireFallback:
    "촬영이 어려우면 사진 없이 문진으로 진행할 수 있습니다.",
  permissionHelp:
    "브라우저 주소창 왼쪽의 자물쇠(또는 사이트 설정)에서 카메라 권한을 허용한 뒤 다시 시도해 주세요.",
} as const;
