/**
 * Pure helpers: match verified usage-guide applicationArea to user-selected body parts.
 * Does not invent usage methods — only token intersection against stored labels.
 */

export type FaceExplorerZone =
  | "hair"
  | "forehead"
  | "eyebrow"
  | "eyes"
  | "cheeks"
  | "nose"
  | "lips"
  | "neck";

/** Broad face tags that may appear on verified face skincare guides. */
const FACE_WIDE_TOKENS = ["얼굴", "face"] as const;

/**
 * Tokens a face-explorer zone may match in guide.applicationArea.
 * Includes zone id, Korean UI labels, and documented aliases only.
 */
export const FACE_EXPLORER_ZONE_AREA_TOKENS: Record<
  FaceExplorerZone,
  readonly string[]
> = {
  hair: ["머리", "두피", "헤어", "hair", "scalp"],
  forehead: ["이마", "forehead", "t존", "t-zone", ...FACE_WIDE_TOKENS],
  eyebrow: ["눈썹", "eyebrow", "아이브로우", ...FACE_WIDE_TOKENS],
  eyes: ["눈", "눈가", "eyes", "eye", "eye_area", "under_eye", ...FACE_WIDE_TOKENS],
  cheeks: ["광대", "볼", "치크", "cheeks", "cheek", ...FACE_WIDE_TOKENS],
  nose: ["코", "nose", ...FACE_WIDE_TOKENS],
  lips: ["입술", "입가", "lips", "lip", "mouth_area", ...FACE_WIDE_TOKENS],
  neck: ["목", "넥", "neck"],
};

export type AnalyzeBodyArea =
  | "forehead"
  | "eye_area"
  | "under_eye"
  | "nose"
  | "cheek"
  | "mouth_area"
  | "chin"
  | "neck"
  | "other";

const ANALYZE_BODY_AREA_LABELS: Record<AnalyzeBodyArea, string> = {
  forehead: "이마",
  eye_area: "눈가",
  under_eye: "눈 밑",
  nose: "코",
  cheek: "볼",
  mouth_area: "입가",
  chin: "턱",
  neck: "목",
  other: "기타",
};

export function normalizeUsageAreaToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * True when any guide applicationArea token intersects selected area tokens.
 * Empty selected list → no match (caller should keep existing UI).
 */
export function usageGuideMatchesSelectedAreas(
  guideAreas: readonly string[],
  selectedAreas: readonly string[]
): boolean {
  if (selectedAreas.length === 0 || guideAreas.length === 0) return false;
  const selected = new Set(
    selectedAreas.map(normalizeUsageAreaToken).filter(Boolean)
  );
  if (selected.size === 0) return false;
  return guideAreas.some((area) =>
    selected.has(normalizeUsageAreaToken(area))
  );
}

export function faceExplorerZoneApplicationAreas(
  zone: FaceExplorerZone
): string[] {
  return [...FACE_EXPLORER_ZONE_AREA_TOKENS[zone]];
}

/** Expand analyze/redness area ids into match tokens (id + Korean label + face-wide when facial). */
export function analyzeBodyAreasToApplicationTokens(
  areas: readonly string[]
): string[] {
  const tokens = new Set<string>();
  for (const raw of areas) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const id = raw.trim();
    tokens.add(id);

    const asBody = id as AnalyzeBodyArea;
    const label = ANALYZE_BODY_AREA_LABELS[asBody];
    if (label) tokens.add(label);

    // Redness observation aliases → same tokens as BodyArea / face-explorer
    if (id === "cheeks") {
      tokens.add("cheek");
      tokens.add("볼");
      tokens.add("광대");
    }
    if (id === "whole_face") {
      for (const wide of FACE_WIDE_TOKENS) tokens.add(wide);
    }

    if (
      asBody === "forehead" ||
      asBody === "eye_area" ||
      asBody === "under_eye" ||
      asBody === "nose" ||
      asBody === "cheek" ||
      asBody === "mouth_area" ||
      asBody === "chin" ||
      id === "cheeks" ||
      id === "whole_face"
    ) {
      for (const wide of FACE_WIDE_TOKENS) tokens.add(wide);
    }
  }
  return [...tokens];
}

export function isFaceExplorerZone(value: string): value is FaceExplorerZone {
  return Object.prototype.hasOwnProperty.call(
    FACE_EXPLORER_ZONE_AREA_TOKENS,
    value
  );
}
