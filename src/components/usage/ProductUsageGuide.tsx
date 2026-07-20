"use client";

import { useEffect, useState } from "react";

import {
  normalizeUsageAreaToken,
  usageGuideMatchesSelectedAreas,
} from "@/lib/media/usageGuideApplicationArea";
import {
  deriveUsageMediaRelationship,
  evaluateContentDisclosure,
  isContentRelationship,
  type ContentRelationship,
} from "@/lib/media/contentDisclosurePolicy";
import ContentDisclosure from "@/components/disclosure/ContentDisclosure";

export type ProductUsageGuideLocale = "en" | "ja" | "ko";

export type StoredUsageGuide = {
  productId: string;
  amountLabel: string;
  orderIndex: number;
  frequency: "morning" | "evening" | "weekly" | "as_needed";
  applicationArea: string[];
  methodSteps: string[];
  cautionText: string[];
  verifiedAt: string;
  media?: {
    mediaType: "video" | "image" | "animation";
    sourceUrl: string;
    disclosureText?: string | null;
    contentRelationship?: ContentRelationship | null;
    sponsorName?: string | null;
    isSponsored?: boolean;
  } | null;
};

const COPY = {
  ko: {
    title: "검증된 사용 가이드",
    empty: "검증된 사용 가이드가 아직 없습니다.",
    amount: "사용량",
    timing: "사용 시점",
    area: "사용 부위",
    method: "바르는 방법",
    caution: "주의",
    source: "사용 영상 보기",
    morning: "아침",
    evening: "저녁",
    weekly: "주 1회 이상",
    as_needed: "필요할 때",
    verified: "마지막 확인",
  },
  ja: {
    title: "確認済み使用ガイド",
    empty: "確認済みの使用ガイドはまだありません。",
    amount: "使用量",
    timing: "使用タイミング",
    area: "使用部位",
    method: "使い方",
    caution: "注意",
    source: "使用動画を見る",
    morning: "朝",
    evening: "夜",
    weekly: "週1回以上",
    as_needed: "必要な時",
    verified: "最終確認",
  },
  en: {
    title: "Verified usage guide",
    empty: "No verified usage guide is available yet.",
    amount: "Amount",
    timing: "When to use",
    area: "Area",
    method: "How to apply",
    caution: "Caution",
    source: "View usage media",
    morning: "Morning",
    evening: "Evening",
    weekly: "Weekly",
    as_needed: "As needed",
    verified: "Last verified",
  },
} satisfies Record<ProductUsageGuideLocale, Record<string, string>>;

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      )
    : [];
}

/** LocalStorage skinProductUsageGuides 항목 검증. 미검증·HTTP 미디어는 거부. */
export function parseVerifiedUsageGuide(
  value: unknown,
  productId: string
): StoredUsageGuide | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.productId !== productId) return null;
  if (typeof row.amountLabel !== "string" || !row.amountLabel.trim()) return null;
  if (!Number.isInteger(row.orderIndex) || Number(row.orderIndex) < 1) return null;
  if (!["morning", "evening", "weekly", "as_needed"].includes(String(row.frequency))) {
    return null;
  }
  const applicationArea = asStringArray(row.applicationArea);
  const methodSteps = asStringArray(row.methodSteps);
  if (applicationArea.length === 0 || methodSteps.length === 0) return null;
  if (
    typeof row.verifiedAt !== "string" ||
    Number.isNaN(new Date(row.verifiedAt).getTime())
  ) {
    return null;
  }

  let media: StoredUsageGuide["media"] = null;
  if (row.media && typeof row.media === "object" && !Array.isArray(row.media)) {
    const candidate = row.media as Record<string, unknown>;
    if (
      ["video", "image", "animation"].includes(String(candidate.mediaType)) &&
      isHttpsUrl(candidate.sourceUrl)
    ) {
      const contentRelationship = isContentRelationship(candidate.contentRelationship)
        ? candidate.contentRelationship
        : null;
      const isSponsored = candidate.isSponsored === true;
      const disclosureText =
        typeof candidate.disclosureText === "string"
          ? candidate.disclosureText.trim() || null
          : null;
      const sponsorName =
        typeof candidate.sponsorName === "string"
          ? candidate.sponsorName.trim() || null
          : null;
      const relationship = deriveUsageMediaRelationship({
        contentRelationship,
        isSponsored,
      });
      const disclosure = evaluateContentDisclosure({
        relationship,
        disclosureText,
        sponsorName,
        httpsOk: true,
        verified: true,
        productLinked: true,
      });
      // Disclosure required but missing / mismatched → do not show media.
      if (!disclosure.eligible) {
        media = null;
      } else {
        media = {
          mediaType: candidate.mediaType as "video" | "image" | "animation",
          sourceUrl: candidate.sourceUrl as string,
          disclosureText: disclosure.disclosureText,
          contentRelationship: relationship,
          sponsorName,
          isSponsored,
        };
      }
    }
  }

  return {
    productId,
    amountLabel: row.amountLabel.trim(),
    orderIndex: Number(row.orderIndex),
    frequency: row.frequency as StoredUsageGuide["frequency"],
    applicationArea,
    methodSteps,
    cautionText: asStringArray(row.cautionText),
    verifiedAt: row.verifiedAt,
    media,
  };
}

export type ProductUsageGuideProps = {
  productId: string;
  locale: ProductUsageGuideLocale;
  /**
   * message: 루틴 화면 — 가이드 없을 때 짧은 문구 표시
   * hidden: 추천 카드·부위 화면 — 가이드 없으면 영역 전체 숨김
   */
  emptyMode?: "message" | "hidden";
  /**
   * 사용자가 선택한 부위 토큰. 지정 시 applicationArea와 교집합이 있는
   * 검증된 가이드만 표시. 미지정 시 기존처럼 productId만으로 표시.
   */
  applicationAreas?: readonly string[];
  className?: string;
};

/**
 * 검증된 제품 사용 가이드 표시 (루틴·추천 카드·부위 화면 공용).
 * 임의 사용법 추론 없음. HTTP/미검증 미디어 표시 없음. 자동재생 없음.
 */
export default function ProductUsageGuide({
  productId,
  locale,
  emptyMode = "message",
  applicationAreas,
  className,
}: ProductUsageGuideProps) {
  const [guide, setGuide] = useState<StoredUsageGuide | null>(null);
  const [loaded, setLoaded] = useState(false);

  const areasKey =
    applicationAreas === undefined
      ? "__unfiltered__"
      : [...applicationAreas].map(normalizeUsageAreaToken).sort().join("|");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("skinProductUsageGuides");
      const values = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(values)) {
        setGuide(null);
        setLoaded(true);
        return;
      }
      const parsed =
        values
          .map((value) => parseVerifiedUsageGuide(value, productId))
          .find(Boolean) ?? null;
      if (
        parsed &&
        applicationAreas !== undefined &&
        !usageGuideMatchesSelectedAreas(parsed.applicationArea, applicationAreas)
      ) {
        setGuide(null);
      } else {
        setGuide(parsed);
      }
    } catch {
      setGuide(null);
    } finally {
      setLoaded(true);
    }
    // areasKey serializes applicationAreas for stable deps
    // eslint-disable-next-line react-hooks/exhaustive-deps -- areasKey covers applicationAreas
  }, [productId, areasKey]);

  const copy = COPY[locale];

  if (!loaded) {
    return null;
  }

  if (!guide) {
    if (emptyMode === "hidden") return null;
    return (
      <p
        className={
          className ??
          "mt-3 border-t border-pink-100 pt-3 text-xs text-gray-500"
        }
      >
        {copy.empty}
      </p>
    );
  }

  const timing = copy[guide.frequency];
  const verified = new Intl.DateTimeFormat(
    locale === "ko" ? "ko-KR" : locale === "ja" ? "ja-JP" : "en-US"
  ).format(new Date(guide.verifiedAt));

  return (
    <div
      className={
        className ??
        "mt-3 border-t border-pink-100 pt-3 text-xs text-gray-700"
      }
      data-usage-guide-product-id={productId}
    >
      <p className="font-semibold text-gray-900">{copy.title}</p>
      <dl className="mt-2 space-y-1.5">
        <div>
          <dt className="inline font-semibold">{copy.amount}: </dt>
          <dd className="inline">{guide.amountLabel}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">{copy.timing}: </dt>
          <dd className="inline">{timing}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">{copy.area}: </dt>
          <dd className="inline">{guide.applicationArea.join(", ")}</dd>
        </div>
      </dl>
      <div className="mt-2">
        <p className="font-semibold">{copy.method}</p>
        <ol className="mt-1 list-decimal space-y-1 pl-4">
          {guide.methodSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      {guide.cautionText.length > 0 ? (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
          <p className="font-semibold">{copy.caution}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {guide.cautionText.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {guide.media ? (
        <div className="mt-2">
          <a
            href={guide.media.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#C2185B] underline hover:no-underline"
          >
            {copy.source}
          </a>
          <ContentDisclosure
            relationship={guide.media.contentRelationship ?? "organic"}
            disclosureText={guide.media.disclosureText}
            locale={locale}
          />
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-gray-500">
        {copy.verified}: {verified}
      </p>
    </div>
  );
}
