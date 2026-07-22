/**
 * Locale messages for landmark capture + voice countdown.
 * Supports ko/en/ja + zh-CN/es for voice; unknown → en.
 */

export type CaptureVoiceLocale = "ko" | "en" | "ja" | "zh-CN" | "es";

export function resolveCaptureVoiceLocale(tag: string | null | undefined): CaptureVoiceLocale {
  const lower = String(tag ?? "").toLowerCase();
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("en")) return "en";
  return "en";
}

export function speechLangForLocale(locale: CaptureVoiceLocale): string {
  switch (locale) {
    case "ko":
      return "ko-KR";
    case "ja":
      return "ja-JP";
    case "zh-CN":
      return "zh-CN";
    case "es":
      return "es-ES";
    case "en":
    default:
      return "en-US";
  }
}

const COUNTDOWN: Record<CaptureVoiceLocale, Record<3 | 2 | 1, string>> = {
  ko: { 3: "셋", 2: "둘", 1: "하나" },
  en: { 3: "Three", 2: "Two", 1: "One" },
  ja: { 3: "さん", 2: "に", 1: "いち" },
  "zh-CN": { 3: "三", 2: "二", 1: "一" },
  es: { 3: "Tres", 2: "Dos", 1: "Uno" },
};

const HOLD: Record<CaptureVoiceLocale, string> = {
  ko: "좋아요. 그대로 유지해 주세요.",
  en: "Great. Hold still.",
  ja: "そのまま動かないでください。",
  "zh-CN": "很好，请保持不动。",
  es: "Muy bien. Mantén la posición.",
};

const CAPTURED: Record<CaptureVoiceLocale, string> = {
  ko: "촬영했어요.",
  en: "Photo captured.",
  ja: "撮影しました。",
  "zh-CN": "已完成拍摄。",
  es: "Foto tomada.",
};

const STATUS_MSG: Record<CaptureVoiceLocale, Partial<Record<string, string>>> = {
  ko: {},
  en: {
    loading_model: "Preparing face guide…",
    no_face: "Place your face inside the guide.",
    multiple_faces: "Only one face should be visible.",
    move_left: "Move your face a little to the left.",
    move_right: "Move your face a little to the right.",
    move_up: "Lower the phone a little.",
    move_down: "Raise the phone a little.",
    move_closer: "Come a little closer.",
    move_farther: "Move a little farther away.",
    rotate_left: "Slowly turn your face toward the left side of the screen.",
    rotate_right: "Slowly turn your face toward the right side of the screen.",
    tilt_up: "Lift your chin a little.",
    tilt_down: "Lower your chin a little.",
    level_head: "Keep your head more level.",
    too_dark: "The lighting is too dark.",
    too_bright: "The lighting is too bright.",
    too_blurry: "Image is blurry. Hold still.",
    face_occluded: "Clear hair or hands covering your face.",
    aligned: "Great. Hold still.",
    detector_unavailable: "Auto-align unavailable. Use the manual guide.",
    inference_slow: "Device is slow. Switching to manual guide.",
    error: "Face guide error. Please capture manually.",
  },
  ja: {
    loading_model: "顔ガイドを準備しています。",
    no_face: "ガイドの中に顔を合わせてください。",
    multiple_faces: "顔は1人だけ映るようにしてください。",
    move_left: "顔を少し左へ動かしてください。",
    move_right: "顔を少し右へ動かしてください。",
    move_up: "スマホを少し下げてください。",
    move_down: "スマホを少し上げてください。",
    move_closer: "もう少し近づいてください。",
    move_farther: "もう少し離れてください。",
    rotate_left: "顔を画面の左側へゆっくり回してください。",
    rotate_right: "顔を画面の右側へゆっくり回してください。",
    tilt_up: "あごを少し上げてください。",
    tilt_down: "あごを少し下げてください。",
    level_head: "頭をまっすぐにしてください。",
    too_dark: "照明が暗すぎます。",
    too_bright: "照明が明るすぎます。",
    too_blurry: "ピントがぼけています。動かないでください。",
    face_occluded: "顔を隠している髪や手を整えてください。",
    aligned: "そのまま動かないでください。",
    detector_unavailable: "自動整列を使えないため手動ガイドで撮影します。",
    inference_slow: "端末性能が低いため手動ガイドに切り替えます。",
    error: "顔ガイドに問題があります。手動で撮影してください。",
  },
  "zh-CN": {
    loading_model: "正在准备面部引导…",
    no_face: "请将面部放入引导框内。",
    multiple_faces: "请确保画面中只有一张脸。",
    move_left: "请将脸稍微向左移动。",
    move_right: "请将脸稍微向右移动。",
    move_up: "请稍微放低手机。",
    move_down: "请稍微抬高手机。",
    move_closer: "请再靠近一点。",
    move_farther: "请再远一点。",
    rotate_left: "请将脸缓慢转向屏幕左侧。",
    rotate_right: "请将脸缓慢转向屏幕右侧。",
    tilt_up: "请稍微抬起下巴。",
    tilt_down: "请稍微低下下巴。",
    level_head: "请将头部摆正。",
    too_dark: "光线太暗。",
    too_bright: "光线太亮。",
    too_blurry: "画面模糊，请保持不动。",
    face_occluded: "请整理遮挡面部的头发或手。",
    aligned: "很好，请保持不动。",
    detector_unavailable: "无法自动对齐，请使用手动引导拍摄。",
    inference_slow: "设备性能不足，已切换为手动引导。",
    error: "面部引导出错，请手动拍摄。",
  },
  es: {
    loading_model: "Preparando la guía facial…",
    no_face: "Coloca tu cara dentro de la guía.",
    multiple_faces: "Solo debe verse una cara.",
    move_left: "Mueve la cara un poco a la izquierda.",
    move_right: "Mueve la cara un poco a la derecha.",
    move_up: "Baja un poco el teléfono.",
    move_down: "Sube un poco el teléfono.",
    move_closer: "Acércate un poco más.",
    move_farther: "Aléjate un poco más.",
    rotate_left: "Gira la cara despacio hacia la izquierda de la pantalla.",
    rotate_right: "Gira la cara despacio hacia la derecha de la pantalla.",
    tilt_up: "Levanta un poco la barbilla.",
    tilt_down: "Baja un poco la barbilla.",
    level_head: "Endereza un poco la cabeza.",
    too_dark: "La luz es demasiado oscura.",
    too_bright: "La luz es demasiado brillante.",
    too_blurry: "La imagen está borrosa. Quédate quieto.",
    face_occluded: "Aparta el cabello o la mano que tapa la cara.",
    aligned: "Muy bien. Mantén la posición.",
    detector_unavailable: "Alineación automática no disponible. Usa la guía manual.",
    inference_slow: "El dispositivo es lento. Cambiando a guía manual.",
    error: "Error en la guía facial. Captura manualmente.",
  },
};

export function countdownUtterance(
  locale: CaptureVoiceLocale,
  digit: 3 | 2 | 1
): string {
  return COUNTDOWN[locale][digit];
}

export function holdStillUtterance(locale: CaptureVoiceLocale): string {
  return HOLD[locale];
}

export function capturedUtterance(locale: CaptureVoiceLocale): string {
  return CAPTURED[locale];
}

export function alignmentStatusMessage(
  locale: CaptureVoiceLocale,
  status: string,
  fallbackKo: string
): string {
  if (locale === "ko") return fallbackKo;
  return STATUS_MSG[locale][status] ?? STATUS_MSG.en[status] ?? fallbackKo;
}

export type SpeechSupport = {
  supported: boolean;
  hasSpeechSynthesis: boolean;
  hasUtterance: boolean;
};

export function detectSpeechSupport(win: {
  speechSynthesis?: unknown;
  SpeechSynthesisUtterance?: unknown;
} | null): SpeechSupport {
  if (!win) {
    return {
      supported: false,
      hasSpeechSynthesis: false,
      hasUtterance: false,
    };
  }
  const hasSpeechSynthesis = typeof win.speechSynthesis === "object" && !!win.speechSynthesis;
  const hasUtterance = typeof win.SpeechSynthesisUtterance === "function";
  return {
    supported: hasSpeechSynthesis && hasUtterance,
    hasSpeechSynthesis,
    hasUtterance,
  };
}
