"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { useLocale } from "@/hooks/useLocale";
import { useCountry } from "@/hooks/useCountry";
import { RecommendedProductCard } from "@/components/recommendation/RecommendedProductCard";
import { RednessObservationFields } from "@/components/analyze/RednessObservationFields";
import {
  JourneyProgress,
  SectionLabel,
  StatusMessage,
} from "@/components/ui/JourneyChrome";
import {
  parseRednessObservation,
  type RednessObservation,
} from "@/lib/ai/rednessObservation";
import {
  analyzeInputSnapshotsEqual,
  clearAnalyzeInputSnapshot,
  loadAnalyzeInputSnapshot,
  saveAnalyzeInputSnapshot,
  type AnalyzeInputSnapshot,
} from "@/lib/ai/analyzeInputSnapshot";
import {
  buildAnalyzeReferencePreview,
  type CurrentAnalyzeInput,
} from "@/lib/ai/analyzeReferencePreview";
import {
  ANALYSIS_RESULT_STORAGE_KEY,
  ANALYZE_SOURCE_STORAGE_KEY,
  clearPersistedRankedProducts,
  loadRankedProductsFromStorage,
  persistTopRankedProducts,
  RANKED_PRODUCTS_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
  type AnalysisResult,
  type CandidateProduct,
  type CurrentProductInput,
  type CurrentProductReaction,
  type CurrentProductUsageTime,
  type RankedProduct,
  type Recommendation,
} from "@/lib/recommend";
import {
  displayBrandName,
  getCanonicalBrandName,
} from "@/lib/brand/displayBrandName";

type Locale = "en" | "ja" | "ko";

type InputMode = "photo" | "manual";
type ToneKo = "밝은" | "중간" | "어두운";
type UndertoneKo = "웜톤" | "쿨톤" | "중립";
type ConcernKo =
  | "붉은기"
  | "건조함"
  | "여드름"
  | "색소침착"
  | "주름"
  | "모공"
  | "자외선";
type SensitivityKo = "민감함" | "보통" | "강한편";

function concernKoToParam(c: ConcernKo): string {
  switch (c) {
    case "붉은기":
      return "Redness";
    case "건조함":
      return "Dryness";
    case "여드름":
      return "Acne";
    case "색소침착":
      return "Pigmentation";
    case "주름":
      return "Anti-aging";
    case "모공":
      return "Pores";
    case "자외선":
      return "UV";
  }
}

const TONE_KO = ["밝은", "중간", "어두운"] as const;
const UNDERTONE_KO = ["웜톤", "쿨톤", "중립"] as const;
const CONCERN_KO = [
  "붉은기",
  "건조함",
  "여드름",
  "색소침착",
  "주름",
  "모공",
  "자외선",
] as const;
const SENSITIVITY_KO = ["민감함", "보통", "강한편"] as const;

function asToneKo(v: string): ToneKo | null {
  return (TONE_KO as readonly string[]).includes(v) ? (v as ToneKo) : null;
}
function asUndertoneKo(v: string): UndertoneKo | null {
  return (UNDERTONE_KO as readonly string[]).includes(v)
    ? (v as UndertoneKo)
    : null;
}
function asSensitivityKo(v: string): SensitivityKo | null {
  return (SENSITIVITY_KO as readonly string[]).includes(v)
    ? (v as SensitivityKo)
    : null;
}
function normalizeLegacyConcern(v: string): ConcernKo | null {
  if ((CONCERN_KO as readonly string[]).includes(v)) return v as ConcernKo;
  if (v === "칙칙함") return "색소침착";
  if (v === "노화방지") return "주름";
  return null;
}
function asConcernKoList(values: string[]): ConcernKo[] {
  const out: ConcernKo[] = [];
  for (const v of values) {
    const n = normalizeLegacyConcern(v);
    if (n && !out.includes(n)) out.push(n);
  }
  return out.length > 0 ? out : ["붉은기"];
}

function toneKoToResultsTone(t: ToneKo): string {
  if (t === "밝은") return "Light";
  if (t === "중간") return "Medium";
  return "Dark";
}

type AnalyzeApiSuccess = {
  analysis: AnalysisResult;
  recommendation: Recommendation;
  source?: string;
};

type AnalyzeApiError = {
  error?: string;
};

type IngredientPrefBody = {
  allergyIngredients?: string[];
  avoidedIngredients?: string[];
  currentProducts?: CurrentProductInput[];
  rednessObservation?: RednessObservation;
};

const USAGE_TIME_OPTIONS: { value: CurrentProductUsageTime; label: string }[] =
  [
    { value: "morning", label: "아침" },
    { value: "evening", label: "저녁" },
    { value: "both", label: "아침·저녁" },
  ];

const REACTION_OPTIONS: { value: CurrentProductReaction; label: string }[] = [
  { value: "comfortable", label: "편안함" },
  { value: "dryness", label: "건조함" },
  { value: "stinging", label: "따가움" },
  { value: "redness", label: "붉어짐" },
  { value: "breakout", label: "트러블" },
  { value: "unknown", label: "잘 모름" },
];

const CATEGORY_SUGGESTIONS = [
  "Cleanser",
  "Toner",
  "Serum",
  "Essence",
  "Cream",
  "Moisturizer",
  "SPF",
  "Other",
];

function createEmptyCurrentProduct(): CurrentProductInput {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `cp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return { id, productName: "" };
}

/** Mock 테스트용 샘플 현재 제품 (보습·성분·저녁 중복 예시) */
function createMockSampleCurrentProducts(): CurrentProductInput[] {
  return [
    {
      id: "mock-cp-1",
      productName: "진정 크림",
      brandName: "COSRX",
      category: "Cream",
      usageTime: "both",
      usageFrequency: "매일",
      keyIngredients: ["세라마이드", "판테놀"],
      reaction: "comfortable",
    },
    {
      id: "mock-cp-2",
      productName: "장벽 보습 로션",
      brandName: "Isntree",
      category: "Moisturizer",
      usageTime: "evening",
      usageFrequency: "매일",
      keyIngredients: ["세라마이드", "히알루론산"],
      reaction: "comfortable",
    },
    {
      id: "mock-cp-3",
      productName: "나이트 세럼",
      brandName: "Purito",
      category: "Serum",
      usageTime: "evening",
      usageFrequency: "주 3회",
      keyIngredients: ["판테놀"],
      reaction: "unknown",
    },
  ];
}

/** 태그 목록에 성분 추가 (trim · 빈값 제외 · 대소문자 무시 중복 제거) */
function addIngredientTags(prev: string[], raw: string): string[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return prev;
  const next = [...prev];
  const seen = new Set(prev.map((x) => x.toLowerCase()));
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(part);
  }
  return next;
}

function IngredientTagField(props: {
  label: string;
  hint: string;
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    if (!draft.trim()) return;
    props.onChange(addIngredientTags(props.tags, draft));
    setDraft("");
  };

  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-gray-900">{props.label}</p>
      <p className="mb-2 text-xs text-gray-500">{props.hint}</p>
      {props.tags.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {props.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                props.onChange(props.tags.filter((t) => t !== tag))
              }
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-pink-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800"
              aria-label={`${tag} 삭제`}
            >
              <span>{tag}</span>
              <span className="text-gray-400" aria-hidden>
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commitDraft();
          }
        }}
        onBlur={commitDraft}
        placeholder={props.placeholder}
        className="w-full min-h-11 rounded-xl border border-pink-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-[#C2185B]/focus:ring-2"
        inputMode="text"
        autoComplete="off"
      />
    </div>
  );
}

function CurrentProductsEditor(props: {
  products: CurrentProductInput[];
  onChange: (next: CurrentProductInput[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CurrentProductInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const startAdd = () => {
    const empty = createEmptyCurrentProduct();
    setEditingId(empty.id);
    setDraft(empty);
    setFormError(null);
  };

  const startEdit = (product: CurrentProductInput) => {
    setEditingId(product.id);
    setDraft({
      ...product,
      keyIngredients: [...(product.keyIngredients ?? [])],
    });
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setFormError(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    const name = draft.productName.trim();
    if (!name) {
      setFormError("제품명은 필수입니다.");
      return;
    }
    const cleaned: CurrentProductInput = {
      id: draft.id,
      productName: name,
    };
    if (draft.brandName?.trim()) {
      cleaned.brandName =
        getCanonicalBrandName(draft.brandName) ?? draft.brandName.trim();
    }
    if (draft.category?.trim()) cleaned.category = draft.category.trim();
    if (draft.usageTime) cleaned.usageTime = draft.usageTime;
    if (draft.usageFrequency?.trim()) {
      cleaned.usageFrequency = draft.usageFrequency.trim();
    }
    if (draft.keyIngredients && draft.keyIngredients.length > 0) {
      cleaned.keyIngredients = draft.keyIngredients;
    }
    if (draft.reaction) cleaned.reaction = draft.reaction;

    const exists = props.products.some((p) => p.id === cleaned.id);
    props.onChange(
      exists
        ? props.products.map((p) => (p.id === cleaned.id ? cleaned : p))
        : [...props.products, cleaned]
    );
    cancelEdit();
  };

  const removeProduct = (id: string) => {
    props.onChange(props.products.filter((p) => p.id !== id));
    if (editingId === id) cancelEdit();
  };

  const fieldClass =
    "w-full min-h-11 rounded-xl border border-pink-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-[#C2185B]/focus:ring-2";

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-sm font-semibold text-gray-900">
          현재 사용 중인 제품 (선택)
        </p>
        <p className="text-xs text-gray-500">
          여러 개 등록 가능 · 제품명만 필수로 직접 입력합니다. (DB 검색은 이후
          연동)
        </p>
      </div>

      {props.products.length > 0 ? (
        <ul className="space-y-2">
          {props.products.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-pink-100 bg-pink-50/30 px-3 py-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {p.brandName
                      ? `${displayBrandName(p.brandName, "ko") ?? p.brandName} · `
                      : ""}
                    {p.productName}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {[
                      p.category,
                      p.usageTime
                        ? USAGE_TIME_OPTIONS.find((o) => o.value === p.usageTime)
                            ?.label
                        : null,
                      p.usageFrequency,
                      p.reaction
                        ? REACTION_OPTIONS.find((o) => o.value === p.reaction)
                            ?.label
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "추가 정보 없음"}
                  </p>
                  {p.keyIngredients && p.keyIngredients.length > 0 ? (
                    <p className="mt-1 text-xs text-gray-500">
                      성분: {p.keyIngredients.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="min-h-9 rounded-full border border-pink-200 bg-white px-3 text-xs font-semibold text-gray-700"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProduct(p.id)}
                    className="min-h-9 rounded-full border border-pink-200 bg-white px-3 text-xs font-semibold text-gray-700"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {draft && editingId ? (
        <div className="space-y-3 rounded-2xl border border-pink-200 bg-white p-3">
          <p className="text-xs font-semibold text-[#C2185B]">
            {props.products.some((p) => p.id === editingId)
              ? "제품 수정"
              : "제품 추가"}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-800">
              제품명 *
            </span>
            <input
              className={fieldClass}
              value={draft.productName}
              onChange={(e) =>
                setDraft({ ...draft, productName: e.target.value })
              }
              placeholder="예: 장벽 크림"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-800">
              브랜드 (선택)
            </span>
            <input
              className={fieldClass}
              value={draft.brandName ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, brandName: e.target.value })
              }
              placeholder="예: 브랜드명"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-800">
              카테고리 (선택)
            </span>
            <input
              className={fieldClass}
              list="current-product-categories"
              value={draft.category ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value })
              }
              placeholder="예: Cream, Serum"
            />
            <datalist id="current-product-categories">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-800">
              사용 시점 (선택)
            </span>
            <select
              className={fieldClass}
              value={draft.usageTime ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft({
                  ...draft,
                  usageTime: v
                    ? (v as CurrentProductUsageTime)
                    : undefined,
                });
              }}
            >
              <option value="">선택 안 함</option>
              {USAGE_TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-800">
              사용 빈도 (선택)
            </span>
            <input
              className={fieldClass}
              value={draft.usageFrequency ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, usageFrequency: e.target.value })
              }
              placeholder="예: 매일, 주 2회"
            />
          </label>
          <IngredientTagField
            label="알고 있는 핵심 성분 (선택)"
            hint="전성분을 추측하지 않습니다. 알고 있는 성분만 입력하세요."
            tags={draft.keyIngredients ?? []}
            onChange={(keyIngredients) =>
              setDraft({ ...draft, keyIngredients })
            }
            placeholder="예: 판테놀, 세라마이드"
          />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-800">
              사용 후 반응 (선택)
            </span>
            <select
              className={fieldClass}
              value={draft.reaction ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft({
                  ...draft,
                  reaction: v ? (v as CurrentProductReaction) : undefined,
                });
              }}
            >
              <option value="">선택 안 함</option>
              {REACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {formError ? (
            <p className="text-xs text-red-600">{formError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={saveDraft}
              className="min-h-10 rounded-full bg-[#C2185B] px-4 text-xs font-semibold text-white"
            >
              저장
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="min-h-10 rounded-full border border-pink-200 bg-white px-4 text-xs font-semibold text-gray-700"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startAdd}
          className="min-h-11 w-full rounded-xl border border-dashed border-pink-300 bg-white px-3 text-sm font-semibold text-[#C2185B]"
        >
          + 제품 추가
        </button>
      )}
    </div>
  );
}

/**
 * Sprint 5 — 브라우저는 Anthropic을 직접 호출하지 않고
 * 동일 오리진 POST /api/analyze 만 호출한다.
 */
async function callAnalyzeApi(
  body:
    | ({
        mode: "photo";
        imageBase64: string;
        mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      } & IngredientPrefBody)
    | ({
        mode: "manual";
        skinTone: string;
        undertone: string;
        concerns: string[];
        sensitivity: string;
      } & IngredientPrefBody)
): Promise<AnalyzeApiSuccess> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // ignore — 아래에서 status 기반으로 처리
  }

  if (!response.ok) {
    const errBody = json as AnalyzeApiError | null;
    const message =
      errBody && typeof errBody.error === "string" && errBody.error.trim()
        ? errBody.error
        : `Analysis failed (${response.status}).`;
    throw new Error(message);
  }

  const data = json as AnalyzeApiSuccess | null;
  if (
    !data ||
    typeof data !== "object" ||
    !data.analysis ||
    !data.recommendation
  ) {
    throw new Error("Invalid analysis response from server.");
  }

  return data;
}

/** analysis + recommendation + source 를 LocalStorage에 저장 */
function persistAnalyzeBundle(payload: {
  analysis: AnalysisResult;
  recommendation: Recommendation;
  source?: string;
}) {
  try {
    window.localStorage.setItem(
      ANALYSIS_RESULT_STORAGE_KEY,
      JSON.stringify(payload.analysis)
    );
    window.localStorage.setItem(
      RECOMMENDATION_STORAGE_KEY,
      JSON.stringify(payload.recommendation)
    );
    if (typeof payload.source === "string" && payload.source.trim()) {
      window.localStorage.setItem(
        ANALYZE_SOURCE_STORAGE_KEY,
        payload.source.trim()
      );
    }
  } catch {
    // ignore quota/serialization errors
  }
}

/**
 * Phase 3B 파이프라인:
 * Recommendation → offer 적격 → 안전 필터 → rankProducts → Top5 → LocalStorage
 */
async function runRankingPipeline(
  recommendation: Recommendation,
  shippingCountry?: string | null
) {
  await persistTopRankedProducts(recommendation, { shippingCountry });
}

export default function AnalyzePage() {
  const { locale } = useLocale();
  const { countryCode } = useCountry();
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>("photo");
  /** 직접 입력 모드의 상담형 단계 (0=기본, 1=민감도, 2=안전·현재제품) */
  const [manualStep, setManualStep] = useState(0);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  /** Phase 3C: 개발용 mock 테스트 상태 메시지 (제품 카드는 표시하지 않음) */
  const [mockTestMessage, setMockTestMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [mockTestLoading, setMockTestLoading] = useState(false);
  /**
   * 개발 전용 버튼 노출 여부.
   * 클라이언트 마운트 후 NODE_ENV 를 확인해 프로덕션에서는 절대 보이지 않게 한다.
   */
  const [showMockButton, setShowMockButton] = useState(false);
  /** Sprint 3 Phase 1 — LocalStorage 랭킹 제품 (최대 5) */
  const [rankedProducts, setRankedProducts] = useState<
    RankedProduct<CandidateProduct>[]
  >([]);

  useEffect(() => {
    // next dev 에서만 true. production 빌드에서는 false.
    setShowMockButton(process.env.NODE_ENV === "development");
  }, []);

  const [manualTone, setManualTone] = useState<ToneKo>("중간");
  const [manualUndertone, setManualUndertone] = useState<UndertoneKo>("중립");
  const [manualConcerns, setManualConcerns] = useState<ConcernKo[]>(["붉은기"]);
  const [manualSensitivity, setManualSensitivity] = useState<SensitivityKo>("보통");
  const [rednessObservation, setRednessObservation] =
    useState<RednessObservation>({});
  const [allergyIngredients, setAllergyIngredients] = useState<string[]>([]);
  const [avoidedIngredients, setAvoidedIngredients] = useState<string[]>([]);
  const [currentProducts, setCurrentProducts] = useState<CurrentProductInput[]>(
    []
  );
  /** 스냅샷·폼 복원 전에는 stale 무효화를 돌리지 않음 */
  const [selectionHydrated, setSelectionHydrated] = useState(false);

  const showRednessDetails = manualConcerns.includes("붉은기");
  const rednessPayload = useMemo(() => {
    if (!showRednessDetails) return undefined;
    return parseRednessObservation(rednessObservation) ?? undefined;
  }, [showRednessDetails, rednessObservation]);

  const currentInputSnapshot = useMemo((): AnalyzeInputSnapshot => {
    if (mode === "photo") {
      return {
        mode: "photo",
        skinTone: "",
        undertone: "",
        concerns: [],
        sensitivity: "",
        rednessObservation: null,
      };
    }
    return {
      mode: "manual",
      skinTone: manualTone,
      undertone: manualUndertone,
      concerns: [...manualConcerns],
      sensitivity: manualSensitivity,
      rednessObservation: showRednessDetails
        ? { ...rednessObservation }
        : null,
    };
  }, [
    mode,
    manualTone,
    manualUndertone,
    manualConcerns,
    manualSensitivity,
    showRednessDetails,
    rednessObservation,
  ]);

  /** 수동 입력 현재값 — 규칙형 참고 미리보기 전용 */
  const currentAnalyzeInput = useMemo((): CurrentAnalyzeInput => {
    return {
      skinTone: manualTone,
      undertone: manualUndertone,
      concerns: [...manualConcerns],
      sensitivity: manualSensitivity,
      ...(showRednessDetails
        ? { rednessObservation: { ...rednessObservation } }
        : {}),
    };
  }, [
    manualTone,
    manualUndertone,
    manualConcerns,
    manualSensitivity,
    showRednessDetails,
    rednessObservation,
  ]);

  const referencePreview = useMemo(
    () => buildAnalyzeReferencePreview(currentAnalyzeInput),
    [currentAnalyzeInput]
  );

  /** C. 확정 AI 결과 — 스냅샷과 입력이 일치할 때만 표시 */
  const showConfirmedAnalysis = useMemo(() => {
    if (!result) return false;
    return analyzeInputSnapshotsEqual(
      currentInputSnapshot,
      loadAnalyzeInputSnapshot()
    );
  }, [result, currentInputSnapshot, selectionHydrated]);

  const ingredientPrefs = useMemo(
    () => ({
      allergyIngredients,
      avoidedIngredients,
      currentProducts,
    }),
    [allergyIngredients, avoidedIngredients, currentProducts]
  );
  const resultsTone = useMemo(() => {
    // 사진 분석 모드에서도 results 이동이 필요하므로 기본값을 Medium으로 둠
    return mode === "manual" ? toneKoToResultsTone(manualTone) : "Medium";
  }, [mode, manualTone]);

  const primaryConcernParam = useMemo(() => {
    const first = manualConcerns[0];
    return first ? concernKoToParam(first) : "Redness";
  }, [manualConcerns]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1] ?? "";
      setImageBase64(base64);
      setResult(null);
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const navigateToResults = (opts?: {
    tone?: string;
    concern?: string;
  }) => {
    const params = new URLSearchParams();
    params.set("tone", opts?.tone ?? resultsTone);
    params.set(
      "concern",
      opts?.concern ??
        (mode === "manual"
          ? primaryConcernParam
          : result?.concerns?.[0]
            ? String(result.concerns[0])
            : "Redness")
    );
    params.set("ai", "1");
    router.push(`/results?${params.toString()}`);
  };

  const handleAnalyzePhoto = async () => {
    if (!imageBase64) {
      setError(locale === "ko" ? "먼저 사진을 업로드해주세요." : "Please upload an image first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const {
        analysis,
        recommendation: nextRecommendation,
        source,
      } = await callAnalyzeApi({
        mode: "photo",
        imageBase64,
        mediaType: "image/jpeg",
        ...ingredientPrefs,
      });
      saveAnalyzeInputSnapshot({
        mode: "photo",
        skinTone: "",
        undertone: "",
        concerns: [],
        sensitivity: "",
        rednessObservation: null,
      });
      setResult(analysis);
      persistAnalyzeBundle({
        analysis,
        recommendation: nextRecommendation,
        source,
      });
      await runRankingPipeline(nextRecommendation, countryCode);
      setRankedProducts(loadRankedProductsFromStorage());
      navigateToResults({
        tone: "Medium",
        concern: analysis.concerns?.[0]
          ? String(analysis.concerns[0])
          : "Redness",
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeManual = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const {
        analysis,
        recommendation: nextRecommendation,
        source,
      } = await callAnalyzeApi({
        mode: "manual",
        skinTone: manualTone,
        undertone: manualUndertone,
        concerns: manualConcerns,
        sensitivity: manualSensitivity,
        ...(rednessPayload ? { rednessObservation: rednessPayload } : {}),
        ...ingredientPrefs,
      });
      saveAnalyzeInputSnapshot({
        mode: "manual",
        skinTone: manualTone,
        undertone: manualUndertone,
        concerns: [...manualConcerns],
        sensitivity: manualSensitivity,
        rednessObservation: showRednessDetails
          ? { ...rednessObservation }
          : null,
      });
      setResult(analysis);
      persistAnalyzeBundle({
        analysis,
        recommendation: nextRecommendation,
        source,
      });
      await runRankingPipeline(nextRecommendation, countryCode);
      setRankedProducts(loadRankedProductsFromStorage());
      navigateToResults({
        tone: toneKoToResultsTone(manualTone),
        concern: primaryConcernParam,
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goToResults = () => {
    if (!result) return;
    if (
      !analyzeInputSnapshotsEqual(
        currentInputSnapshot,
        loadAnalyzeInputSnapshot()
      )
    ) {
      return;
    }
    navigateToResults();
  };

  const summary =
    showConfirmedAnalysis && result
      ? locale === "ko"
        ? result.summary_ko
        : locale === "ja"
          ? result.summary_ja
          : result.summary_en
      : null;

  const canAnalyzePhoto = !!imageBase64 && !loading;

  const clearResult = () => {
    try {
      window.localStorage.removeItem(ANALYSIS_RESULT_STORAGE_KEY);
      window.localStorage.removeItem(RECOMMENDATION_STORAGE_KEY);
      window.localStorage.removeItem(ANALYZE_SOURCE_STORAGE_KEY);
      clearPersistedRankedProducts();
      clearAnalyzeInputSnapshot();
    } catch {
      // ignore
    }
    setResult(null);
    setRankedProducts([]);
  };

  /**
   * 마운트: 입력 스냅샷으로 폼 복원 후 분석/랭킹 복원.
   * skinRecommendation 은 파이프라인이 쓴 값만 사용 — 여기서 재생성하지 않음.
   */
  useEffect(() => {
    const snap = loadAnalyzeInputSnapshot();
    if (snap?.mode === "manual") {
      setMode("manual");
      const tone = asToneKo(snap.skinTone);
      const undertone = asUndertoneKo(snap.undertone);
      const sensitivity = asSensitivityKo(snap.sensitivity);
      if (tone) setManualTone(tone);
      if (undertone) setManualUndertone(undertone);
      if (sensitivity) setManualSensitivity(sensitivity);
      setManualConcerns(asConcernKoList(snap.concerns));
      if (snap.rednessObservation) {
        setRednessObservation(snap.rednessObservation);
      }
    } else if (snap?.mode === "photo") {
      setMode("photo");
    }

    try {
      const saved = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AnalysisResult;
        setResult(parsed);
      }
    } catch {
      // ignore parse errors
    }
    setRankedProducts(loadRankedProductsFromStorage());
    setSelectionHydrated(true);
  }, []);

  // Persist analysis result (text only) to localStorage — UI contract unchanged
  useEffect(() => {
    if (!result) return;
    try {
      window.localStorage.setItem(
        ANALYSIS_RESULT_STORAGE_KEY,
        JSON.stringify(result)
      );
    } catch {
      // ignore quota/serialization errors
    }
  }, [result]);

  /** 선택값이 마지막 분석과 다르면 preview·제품 storage 무효화 */
  useEffect(() => {
    if (!selectionHydrated) return;
    if (!result && rankedProducts.length === 0) return;
    const snap = loadAnalyzeInputSnapshot();
    if (analyzeInputSnapshotsEqual(currentInputSnapshot, snap)) return;
    clearResult();
  }, [selectionHydrated, currentInputSnapshot, result, rankedProducts.length]);

  /**
   * Phase 3C / Sprint 5 — Mock 버튼도 POST /api/analyze 경유.
   * 서버 mock Recommendation 수신 후 기존 랭킹 파이프라인만 실행.
   */
  const handleMockRecommendationTest = async () => {
    if (process.env.NODE_ENV !== "development") return;
    setMockTestLoading(true);
    setMockTestMessage(null);
    try {
      // 1) 서버 라우트만 호출 (클라이언트에서 analyzeSkin / createMock 직접 호출 금지)
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "manual",
          skinTone: "중간",
          undertone: "중립",
          concerns: ["붉은기", "건조함"],
          sensitivity: "민감함",
          allergyIngredients:
            allergyIngredients.length > 0
              ? allergyIngredients
              : ["향료"],
          avoidedIngredients:
            avoidedIngredients.length > 0
              ? avoidedIngredients
              : ["고함량 알코올"],
          currentProducts:
            currentProducts.length > 0
              ? currentProducts
              : createMockSampleCurrentProducts(),
        }),
      });

      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const errBody = json as AnalyzeApiError | null;
        throw new Error(
          errBody && typeof errBody.error === "string" && errBody.error.trim()
            ? errBody.error
            : `Analysis failed (${response.status}).`
        );
      }

      // 2) 서버 recommendation 전체 유지 (확장 필드 포함) + analysis 저장
      const rawRec =
        json &&
        typeof json === "object" &&
        "recommendation" in json &&
        (json as { recommendation?: unknown }).recommendation &&
        typeof (json as { recommendation: unknown }).recommendation === "object"
          ? ((json as { recommendation: Record<string, unknown> })
              .recommendation as Record<string, unknown>)
          : json && typeof json === "object"
            ? (json as Record<string, unknown>)
            : null;

      if (!rawRec) {
        throw new Error("Invalid recommendation response from server.");
      }

      const recommendation = rawRec as unknown as Recommendation;

      if (
        !Array.isArray(recommendation.skinConcerns) ||
        !Array.isArray(recommendation.recommendedIngredients) ||
        typeof recommendation.confidenceScore !== "number"
      ) {
        throw new Error("Invalid recommendation shape from server.");
      }

      const analysisPayload =
        json &&
        typeof json === "object" &&
        "analysis" in json &&
        (json as { analysis?: unknown }).analysis &&
        typeof (json as { analysis: unknown }).analysis === "object"
          ? (json as { analysis: AnalysisResult }).analysis
          : null;

      const source =
        json &&
        typeof json === "object" &&
        typeof (json as { source?: unknown }).source === "string"
          ? ((json as { source: string }).source as string)
          : undefined;

      if (!analysisPayload) {
        throw new Error("Invalid analysis response from server.");
      }

      setResult(analysisPayload);
      persistAnalyzeBundle({
        analysis: analysisPayload,
        recommendation,
        source,
      });

      const top = await persistTopRankedProducts(recommendation, {
        shippingCountry: countryCode,
      });

      window.localStorage.setItem(
        RANKED_PRODUCTS_STORAGE_KEY,
        JSON.stringify(top)
      );

      console.log("Mock recommendation saved via /api/analyze");

      setRankedProducts(loadRankedProductsFromStorage());

      setMockTestMessage({
        type: top.length > 0 ? "success" : "error",
        text:
          top.length > 0
            ? `Mock 추천 Top${top.length} 저장 완료 — 결과 페이지로 이동합니다`
            : "저장 완료 — 결과 페이지로 이동합니다 (랭킹 0건)",
      });

      navigateToResults({
        tone: "Medium",
        concern: concernKoToParam("붉은기"),
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setMockTestMessage({
        type: "error",
        text: `Mock 추천 테스트 실패: ${err.message}`,
      });
    } finally {
      setMockTestLoading(false);
    }
  };

  const manualStepTotal = 3;
  const journeyStep =
    mode === "photo" ? 1 : Math.min(manualStep + 1, manualStepTotal);

  return (
    <div className="kb-surface min-h-screen overflow-x-hidden text-[#1A1A1A]">
      <Head>
        <title>
          {locale === "ko"
            ? "AI 피부 가이드 | K-Beauty Match"
            : locale === "ja"
              ? "AIスキンガイド | K-Beauty Match"
              : "AI Skin Guide | K-Beauty Match"}
        </title>
        <meta
          name="description"
          content={
            locale === "ko"
              ? "사진 또는 기본 정보로 피부 타입·고민·관심 성분을 정리하는 K-뷰티 분석 가이드입니다."
              : locale === "ja"
                ? "写真または基本情報から肌タイプ・悩み・成分を整理するK-Beauty分析ガイドです。"
                : "AI-powered K-beauty skin information guide."
          }
        />
      </Head>
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-6 sm:py-10">
        {/* Page intro */}
        <header className="mb-6 sm:mb-8">
          <p className="kb-eyebrow">
            {locale === "ko"
              ? "피부 분석"
              : locale === "ja"
                ? "AIスキンガイド"
                : "AI SKIN GUIDE"}
          </p>
          <h1 className="kb-display mt-3 text-balance text-3xl tracking-tight md:text-4xl">
            피부 상태를 단계적으로 정리해 보세요
          </h1>
          <p className="kb-lead mt-3 max-w-3xl text-sm">
            사진 또는 기본 정보로 피부 타입·고민·관심 성분을 정리합니다. 의료
            진단이 아니라 K-뷰티 정보 탐색을 돕는 가이드입니다.
          </p>
          <div className="mt-5 max-w-md">
            <JourneyProgress
              current={journeyStep}
              total={mode === "photo" ? 1 : manualStepTotal}
              label="분석 진행"
            />
          </div>
          {/* Phase 3C: development 전용 Mock 추천 테스트 버튼 */}
          {showMockButton ? (
            <div className="mt-4">
              <button
                type="button"
                data-testid="mock-recommendation-test"
                onClick={handleMockRecommendationTest}
                disabled={mockTestLoading}
                className={`rounded-full border border-[#C2185B] bg-white px-4 py-2 text-xs font-semibold text-[#C2185B] transition hover:bg-pink-50 ${
                  mockTestLoading ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                {mockTestLoading ? "Mock 테스트 중..." : "Mock 추천 테스트"}
              </button>
              {mockTestMessage ? (
                <p
                  className={`mt-2 text-xs ${
                    mockTestMessage.type === "success"
                      ? "text-green-700"
                      : "text-red-600"
                  }`}
                >
                  {mockTestMessage.text}
                </p>
              ) : null}
            </div>
          ) : null}
        </header>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="분석 방법">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "photo"}
            onClick={() => setMode("photo")}
            className={`kb-chip ${mode === "photo" ? "is-selected" : ""}`}
          >
            사진으로 분석
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "manual"}
            onClick={() => {
              setMode("manual");
              setManualStep(0);
            }}
            className={`kb-chip ${mode === "manual" ? "is-selected" : ""}`}
          >
            직접 입력
          </button>
        </div>

        {loading ? (
          <div className="kb-status-info mb-4" role="status" aria-live="polite">
            피부를 정리하는 중입니다. 잠시만 기다려 주세요…
          </div>
        ) : null}

        {/* Input + Result */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Left: input */}
          <div className="kb-panel relative">
            {mode === "photo" ? (
              <div>
                <SectionLabel>사진 업로드</SectionLabel>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="flex h-56 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-4 text-center text-sm text-[var(--text-muted)]"
                  onClick={() => {
                    const input = document.getElementById("file-input");
                    if (input) (input as HTMLInputElement).click();
                  }}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="업로드한 피부 사진 미리보기"
                      className="h-full w-auto rounded-2xl object-cover"
                    />
                  ) : (
                    <div>
                      <p className="mb-1 font-medium text-gray-800">
                        사진을 업로드하세요
                      </p>
                      <p className="text-xs text-[var(--text-subtle)]">
                        밝은 조명에서 정면 사진을 권장합니다
                      </p>
                    </div>
                  )}
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <p className="mt-3 text-xs text-[var(--text-subtle)]">
                  결과는 참고용이며 실제 피부 상태와 다를 수 있습니다.
                </p>

                <div className="kb-sticky-actions mt-4">
                  <button
                    type="button"
                    onClick={handleAnalyzePhoto}
                    disabled={!canAnalyzePhoto}
                    className="kb-btn kb-btn-primary w-full sm:w-auto"
                  >
                    {loading ? "분석 중…" : "AI 분석 시작"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {manualStep === 0 ? (
                  <>
                    <div>
                      <SectionLabel>피부톤</SectionLabel>
                      <div className="flex flex-wrap gap-2">
                        {(["밝은", "중간", "어두운"] as ToneKo[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            aria-pressed={manualTone === v}
                            onClick={() => setManualTone(v)}
                            className={`kb-chip ${manualTone === v ? "is-selected" : ""}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <SectionLabel>언더톤</SectionLabel>
                      <div className="flex flex-wrap gap-2">
                        {(["웜톤", "쿨톤", "중립"] as UndertoneKo[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            aria-pressed={manualUndertone === v}
                            onClick={() => setManualUndertone(v)}
                            className={`kb-chip ${manualUndertone === v ? "is-selected" : ""}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <SectionLabel>주요 고민</SectionLabel>
                      <p className="mb-2 text-xs text-[var(--text-subtle)]">
                        여러 개 선택할 수 있습니다. 붉은기를 고르면 세부 관찰을
                        이어서 입력할 수 있습니다.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            "붉은기",
                            "건조함",
                            "여드름",
                            "색소침착",
                            "주름",
                            "모공",
                            "자외선",
                          ] as ConcernKo[]
                        ).map((v) => {
                          const selected = manualConcerns.includes(v);
                          return (
                            <button
                              key={v}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => {
                                setManualConcerns((prev) => {
                                  const next: ConcernKo[] = selected
                                    ? prev.filter((x) => x !== v)
                                    : [...prev, v];
                                  const resolved: ConcernKo[] = next.length
                                    ? next
                                    : ["붉은기"];
                                  if (!resolved.includes("붉은기")) {
                                    setRednessObservation({});
                                  }
                                  return resolved;
                                });
                              }}
                              className={`kb-chip ${selected ? "is-selected" : ""}`}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {showRednessDetails ? (
                      <RednessObservationFields
                        value={rednessObservation}
                        onChange={setRednessObservation}
                      />
                    ) : null}

                    <div className="kb-sticky-actions flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="kb-btn kb-btn-primary"
                        onClick={() => setManualStep(1)}
                      >
                        다음
                      </button>
                    </div>
                  </>
                ) : null}

                {manualStep === 1 ? (
                  <>
                    <div>
                      <SectionLabel>민감도</SectionLabel>
                      <div className="flex flex-wrap gap-2">
                        {(["민감함", "보통", "강한편"] as SensitivityKo[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            aria-pressed={manualSensitivity === v}
                            onClick={() => setManualSensitivity(v)}
                            className={`kb-chip ${manualSensitivity === v ? "is-selected" : ""}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="kb-sticky-actions flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="kb-btn kb-btn-secondary"
                        onClick={() => setManualStep(0)}
                      >
                        이전
                      </button>
                      <button
                        type="button"
                        className="kb-btn kb-btn-primary"
                        onClick={() => setManualStep(2)}
                      >
                        다음
                      </button>
                    </div>
                  </>
                ) : null}

                {manualStep === 2 ? (
                  <>
                    <IngredientTagField
                      label="알레르기가 있는 성분 (선택)"
                      hint="쉼표 또는 Enter로 추가 · 태그 탭하여 삭제"
                      tags={allergyIngredients}
                      onChange={setAllergyIngredients}
                      placeholder="예: 향료, 라놀린"
                    />

                    <IngredientTagField
                      label="사용을 피하고 싶은 성분 (선택)"
                      hint="쉼표 또는 Enter로 추가 · 태그 탭하여 삭제"
                      tags={avoidedIngredients}
                      onChange={setAvoidedIngredients}
                      placeholder="예: 고함량 알코올, 에센셜 오일"
                    />

                    <CurrentProductsEditor
                      products={currentProducts}
                      onChange={setCurrentProducts}
                    />

                    <div className="kb-sticky-actions space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="kb-btn kb-btn-secondary"
                          onClick={() => setManualStep(1)}
                        >
                          이전
                        </button>
                        <button
                          type="button"
                          onClick={handleAnalyzeManual}
                          disabled={loading}
                          className="kb-btn kb-btn-primary"
                        >
                          {loading ? "분석 중…" : "AI 분석 시작"}
                        </button>
                      </div>
                      <p className="text-xs text-[var(--text-subtle)]">
                        알레르기·회피 성분과 현재 제품은 추천·루틴 점검 참고용입니다.
                        의료 진단이 아닙니다.
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {error ? (
              <div className="mt-4 space-y-3">
                <StatusMessage tone="error">{error}</StatusMessage>
                <button
                  type="button"
                  className="kb-btn kb-btn-secondary"
                  onClick={() => {
                    setError(null);
                    if (mode === "photo") void handleAnalyzePhoto();
                    else void handleAnalyzeManual();
                  }}
                >
                  다시 시도
                </button>
              </div>
            ) : null}
          </div>

          {/* Right: 확정 AI 결과 또는 규칙형 참고 미리보기 (절대 혼합 금지) */}
          <div className="kb-panel">
            {showConfirmedAnalysis && result ? (
              <div className="space-y-4">
                <h3 className="kb-display text-lg text-[var(--brand)]">
                  AI 분석 결과
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[var(--radius-panel)] bg-[var(--surface-muted)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      피부 타입
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {result.skin_type}
                    </p>
                  </div>

                  <div className="rounded-[var(--radius-panel)] bg-[var(--surface-muted)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      주요 고민
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(result.concerns ?? []).map((c, idx) => (
                        <span
                          key={`${c}-${idx}`}
                          className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-800"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      추천 성분
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(result.ingredients ?? []).map((ing, idx) => (
                        <span
                          key={`${ing}-${idx}`}
                          className="inline-flex rounded-full bg-[#C2185B] px-3 py-1 text-xs font-medium text-white"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      루틴 가이드
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
                      {(result.routine_tips ?? []).map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {summary ? (
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-sm leading-relaxed text-gray-800">
                      {summary}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={goToResults}
                    className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#a3154f]"
                  >
                    제품 정보 보기
                  </button>
                  <Link
                    href="/routine"
                    className="inline-flex items-center justify-center rounded-full border border-pink-200 bg-white px-5 py-2 text-xs font-semibold text-gray-800 transition hover:bg-pink-50"
                  >
                    루틴 가이드 보기
                  </Link>
                  <Link
                    href="#"
                    className="inline-flex items-center justify-center rounded-full border border-pink-200 bg-white px-5 py-2 text-xs font-semibold text-gray-800 transition hover:bg-pink-50"
                  >
                    성분별로 보기
                  </Link>
                </div>

                <p className="text-xs text-gray-500">
                  AI 분석 결과는 참고용 정보이며, 실제 피부 상태와 다를 수 있습니다.
                </p>
              </div>
            ) : mode === "manual" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-['Playfair_Display',serif] text-lg font-semibold text-gray-900">
                    현재 선택 기준 미리보기
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    AI 분석 전 참고용 정보입니다.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-dashed border-pink-200 bg-pink-50/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      참고 프로필
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {referencePreview.skin_type}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-dashed border-pink-200 bg-pink-50/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      주요 고민
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {referencePreview.concerns.map((c, idx) => (
                        <span
                          key={`${c}-${idx}`}
                          className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-800"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-pink-200 bg-pink-50/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      참고 성분
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {referencePreview.ingredients.map((ing, idx) => (
                        <span
                          key={`${ing}-${idx}`}
                          className="inline-flex rounded-full bg-[#C2185B]/90 px-3 py-1 text-xs font-medium text-white"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-pink-200 bg-pink-50/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      아침 루틴 참고
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
                      {referencePreview.morning_tips.map((tip, idx) => (
                        <li key={`am-${idx}`}>{tip}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      저녁 루틴 참고
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
                      {referencePreview.evening_tips.map((tip, idx) => (
                        <li key={`pm-${idx}`}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {referencePreview.cautionIngredients.length > 0 ? (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                      주의해서 볼 성분
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {referencePreview.cautionIngredients.map((ing, idx) => (
                        <span
                          key={`caution-${idx}`}
                          className="inline-flex rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-900"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {referencePreview.avoidHints.length > 0 ? (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                      민감도 기준 참고
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900/80">
                      {referencePreview.avoidHints.map((hint, idx) => (
                        <li key={idx}>{hint}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {referencePreview.counselingNote_ko ? (
                  <div
                    className="rounded-2xl border border-[#8B1E3F]/20 bg-[#FDF6F8] p-4"
                    role="status"
                  >
                    <p className="text-sm font-medium text-[#8B1E3F]">
                      {referencePreview.counselingNote_ko}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-sm leading-relaxed text-gray-800">
                    {referencePreview.summary_ko}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    {referencePreview.toneNote_ko}
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="inline-flex cursor-not-allowed items-center justify-center rounded-full bg-gray-300 px-5 py-2 text-xs font-semibold text-white"
                  >
                    AI 분석 후 제품 정보 보기
                  </button>
                  <p className="text-xs text-gray-500">
                    분석을 실행하면 현재 선택 기준 제품 정보를 확인할 수
                    있습니다.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                사진을 업로드한 뒤 AI 분석을 실행하면 결과가 표시됩니다. 선택값
                기반 참고 미리보기는 「직접 입력」모드에서 볼 수 있습니다.
              </p>
            )}
          </div>
        </section>

        {/* 확정 분석 + snapshot 일치 시에만 이전 랭킹 제품 표시 */}
        {showConfirmedAnalysis && rankedProducts.length > 0 ? (
          <section
            className="mt-10 border-t border-pink-100 pt-8"
            aria-label="추천 제품"
          >
            <h2 className="font-['Playfair_Display',serif] text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
              추천 제품
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              분석·매칭 결과 상위 {rankedProducts.length}개 제품입니다.
              {countryCode
                ? ` (구매 링크: ${countryCode} 기준)`
                : ""}
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {rankedProducts.map((ranked, index) => (
                <RecommendedProductCard
                  key={ranked.product.id}
                  rank={index + 1}
                  ranked={ranked}
                  locale={locale}
                  countryCode="KR"
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

