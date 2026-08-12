export const PRODUCT_USAGE_GUIDES_STORAGE_KEY = "skinProductUsageGuides";

type StoredUsageGuide = {
  productId: string;
  amountLabel: string;
  orderIndex: number;
  frequency: "morning" | "evening" | "weekly" | "as_needed";
  applicationArea: string[];
  methodSteps: string[];
  cautionText: string[];
  verifiedAt: string;
  media: {
    mediaType: "video" | "image" | "animation";
    sourceUrl: string;
    disclosureText: string | null;
  } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function parseUsageGuide(productId: string, value: unknown): StoredUsageGuide | null {
  if (!isRecord(value)) return null;
  const amountLabel = typeof value.amountLabel === "string" ? value.amountLabel.trim() : "";
  const orderIndex = Number(value.orderIndex);
  const frequency = String(value.frequency);
  const applicationArea = asStringArray(value.applicationArea);
  const methodSteps = asStringArray(value.methodSteps);
  const cautionText = asStringArray(value.cautionText);
  const verifiedAt = typeof value.verifiedAt === "string" ? value.verifiedAt : "";

  if (!productId || !amountLabel || !Number.isInteger(orderIndex) || orderIndex < 1) return null;
  if (!["morning", "evening", "weekly", "as_needed"].includes(frequency)) return null;
  if (applicationArea.length === 0 || methodSteps.length === 0) return null;
  if (!verifiedAt || Number.isNaN(new Date(verifiedAt).getTime())) return null;

  let media: StoredUsageGuide["media"] = null;
  if (isRecord(value.media)) {
    const mediaType = String(value.media.mediaType);
    if (["video", "image", "animation"].includes(mediaType) && isHttpsUrl(value.media.sourceUrl)) {
      media = {
        mediaType: mediaType as StoredUsageGuide["media"] extends infer T
          ? T extends { mediaType: infer M }
            ? M
            : never
          : never,
        sourceUrl: value.media.sourceUrl,
        disclosureText:
          typeof value.media.disclosureText === "string"
            ? value.media.disclosureText.trim() || null
            : null,
      };
    }
  }

  return {
    productId,
    amountLabel,
    orderIndex,
    frequency: frequency as StoredUsageGuide["frequency"],
    applicationArea,
    methodSteps,
    cautionText,
    verifiedAt,
    media,
  };
}

export function syncVerifiedUsageGuidesFromRankedProducts(value: unknown): StoredUsageGuide[] {
  if (typeof window === "undefined" || !Array.isArray(value)) return [];

  const guides: StoredUsageGuide[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !isRecord(entry.product)) continue;
    const productId = typeof entry.product.id === "string" ? entry.product.id.trim() : "";
    const candidate = entry.product.usageGuide ?? entry.product.usage_guide;
    const guide = parseUsageGuide(productId, candidate);
    if (guide) guides.push(guide);
  }

  try {
    if (guides.length > 0) {
      window.localStorage.setItem(PRODUCT_USAGE_GUIDES_STORAGE_KEY, JSON.stringify(guides));
    } else {
      window.localStorage.removeItem(PRODUCT_USAGE_GUIDES_STORAGE_KEY);
    }
  } catch {
    return [];
  }

  return guides;
}
