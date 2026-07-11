"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { useLocale } from "@/hooks/useLocale";
import { RecommendedProductCard } from "@/components/recommendation/RecommendedProductCard";
import {
  ANALYSIS_RESULT_STORAGE_KEY,
  clearPersistedRankedProducts,
  createMockRecommendation,
  loadRankedProductsFromStorage,
  persistTopRankedProducts,
  RANKED_PRODUCTS_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
  parseAnalysisTextToRecommendation,
  toRecommendation,
  type AnalysisResult,
  type CandidateProduct,
  type RankedProduct,
  type Recommendation,
} from "@/lib/recommend";

type Locale = "en" | "ja" | "ko";

type InputMode = "photo" | "manual";
type ToneKo = "밝은" | "중간" | "어두운";
type UndertoneKo = "웜톤" | "쿨톤" | "중립";
type ConcernKo = "붉은기" | "건조함" | "여드름" | "칙칙함" | "노화방지";
type SensitivityKo = "민감함" | "보통" | "강한편";

function concernKoToParam(c: ConcernKo): string {
  switch (c) {
    case "붉은기":
      return "Redness";
    case "건조함":
      return "Dryness";
    case "여드름":
      return "Acne";
    case "칙칙함":
      return "Dullness";
    case "노화방지":
      return "Anti-aging";
  }
}

function toneKoToResultsTone(t: ToneKo): string {
  if (t === "밝은") return "Light";
  if (t === "중간") return "Medium";
  return "Dark";
}

async function callAnthropic(
  payload: unknown
): Promise<{ analysis: AnalysisResult; recommendation: Recommendation }> {
  if (!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${text}`);
  }

  const json = await response.json();
  const contentText: string | undefined =
    json?.content?.[0]?.text ?? json?.content?.[0]?.text_value;

  if (!contentText) {
    throw new Error("No content returned from Anthropic.");
  }

  const { analysis, recommendation } =
    parseAnalysisTextToRecommendation(contentText);
  return { analysis, recommendation };
}

function persistRecommendation(recommendation: Recommendation) {
  try {
    window.localStorage.setItem(
      RECOMMENDATION_STORAGE_KEY,
      JSON.stringify(recommendation)
    );
  } catch {
    // ignore quota/serialization errors
  }
}

/**
 * Phase 3B 파이프라인:
 * Recommendation → fetchCandidateProducts → rankProducts → Top5 → LocalStorage
 * 분석 UI는 변경하지 않으며, 제품 목록도 화면에 그리지 않는다.
 */
async function runRankingPipeline(recommendation: Recommendation) {
  await persistTopRankedProducts(recommendation);
}

export default function AnalyzePage() {
  const { locale } = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>("photo");

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

  /** 마운트 시 저장된 랭킹 결과 복원 */
  useEffect(() => {
    setRankedProducts(loadRankedProductsFromStorage());
  }, []);

  const [manualTone, setManualTone] = useState<ToneKo>("중간");
  const [manualUndertone, setManualUndertone] = useState<UndertoneKo>("중립");
  const [manualConcerns, setManualConcerns] = useState<ConcernKo[]>(["붉은기"]);
  const [manualSensitivity, setManualSensitivity] = useState<SensitivityKo>("보통");

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

  const handleAnalyzePhoto = async () => {
    if (!imageBase64) {
      setError(locale === "ko" ? "먼저 사진을 업로드해주세요." : "Please upload an image first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { analysis, recommendation: nextRecommendation } =
        await callAnthropic({
          model: "claude-sonnet-4-20250514",
          max_tokens: 700,
          system:
            "You are a K-beauty skincare information guide. Based on the skin photo provided, analyze and respond ONLY in JSON: {\"skin_type\": \"string\", \"concerns\": [\"string\"], \"ingredients\": [\"string\"], \"summary_ko\": \"Korean summary\", \"summary_en\": \"English summary\", \"summary_ja\": \"Japanese summary\", \"routine_tips\": [\"string\"]}",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this skin photo and return JSON only.",
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
        });
      setResult(analysis);
      persistRecommendation(nextRecommendation);
      // Phase 3B: 분석 UI와 무관하게 백그라운드로 Top5 랭킹 저장
      await runRankingPipeline(nextRecommendation);
      // Sprint 3 Phase 1: 저장된 랭킹을 화면에 반영
      setRankedProducts(loadRankedProductsFromStorage());
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
      const payload = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 700,
        system:
          "You are a K-beauty skincare information guide. Based on the skin information provided, analyze and respond ONLY in JSON: {\"skin_type\": \"string\", \"concerns\": [\"string\"], \"ingredients\": [\"string\"], \"summary_ko\": \"Korean summary\", \"summary_en\": \"English summary\", \"summary_ja\": \"Japanese summary\", \"routine_tips\": [\"string\"]}",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Skin info (Korean labels):
- skin_tone: ${manualTone}
- undertone: ${manualUndertone}
- main_concerns: ${manualConcerns.join(", ")}
- sensitivity: ${manualSensitivity}
Return JSON only.`,
              },
            ],
          },
        ],
      };
      const { analysis, recommendation: nextRecommendation } =
        await callAnthropic(payload);
      setResult(analysis);
      persistRecommendation(nextRecommendation);
      // Phase 3B: 분석 UI와 무관하게 백그라운드로 Top5 랭킹 저장
      await runRankingPipeline(nextRecommendation);
      // Sprint 3 Phase 1: 저장된 랭킹을 화면에 반영
      setRankedProducts(loadRankedProductsFromStorage());
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goToResults = () => {
    if (!result) return;
    const params = new URLSearchParams();
    params.set("tone", resultsTone);
    params.set(
      "concern",
      mode === "manual"
        ? primaryConcernParam
        : result.concerns?.[0]
          ? String(result.concerns[0])
          : "Redness"
    );
    params.set("ai", "1");
    router.push(`/results?${params.toString()}`);
  };

  const summary =
    locale === "ko"
      ? result?.summary_ko
      : locale === "ja"
        ? result?.summary_ja
        : result?.summary_en;

  const canAnalyzePhoto = !!imageBase64 && !loading;

  // Load last analysis from localStorage on mount; rebuild Recommendation for Phase 1+
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AnalysisResult;
        setResult(parsed);
        const savedRec = window.localStorage.getItem(RECOMMENDATION_STORAGE_KEY);
        if (!savedRec) {
          persistRecommendation(toRecommendation(parsed));
        }
      }
    } catch {
      // ignore parse errors
    }
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

  const clearResult = () => {
    try {
      window.localStorage.removeItem(ANALYSIS_RESULT_STORAGE_KEY);
      window.localStorage.removeItem(RECOMMENDATION_STORAGE_KEY);
      clearPersistedRankedProducts();
    } catch {
      // ignore
    }
    setResult(null);
    setRankedProducts([]);
  };

  /**
   * Phase 3C — AI 없이 랭킹 파이프라인만 검증.
   * mock Recommendation → persistTopRankedProducts → LocalStorage
   */
  const handleMockRecommendationTest = async () => {
    if (process.env.NODE_ENV !== "development") return;
    setMockTestLoading(true);
    setMockTestMessage(null);
    try {
      const mockRecommendation = createMockRecommendation();

      // 1) skinRecommendation 저장
      window.localStorage.setItem(
        RECOMMENDATION_STORAGE_KEY,
        JSON.stringify(mockRecommendation)
      );

      // 2) 후보 로드 + 랭킹 + skinRankedProducts 저장
      const top = await persistTopRankedProducts(mockRecommendation);

      // 3) 키가 비어 있지 않도록 한 번 더 보장 (조회 실패 시에도 [])
      window.localStorage.setItem(
        RANKED_PRODUCTS_STORAGE_KEY,
        JSON.stringify(top)
      );

      console.log("Mock recommendation saved");

      // Sprint 3 Phase 1: 카드 목록 갱신
      setRankedProducts(loadRankedProductsFromStorage());

      setMockTestMessage({
        type: top.length > 0 ? "success" : "error",
        text:
          top.length > 0
            ? `Mock 추천 Top${top.length} 저장 완료 (skinRecommendation, skinRankedProducts)`
            : "skinRecommendation / skinRankedProducts 저장됨 (랭킹 0건 — DB 후보 확인)",
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

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
      <Head>
        <title>AI Skin Guide | KBEAUTY GUIDE</title>
        <meta
          name="description"
          content="AI-powered K-beauty skin information guide."
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        {/* Page intro */}
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#C2185B]">
            AI SKIN GUIDE
          </p>
          <h1 className="mt-3 font-['Playfair_Display',serif] text-3xl font-bold tracking-tight md:text-4xl">
            AI로 피부 정보를 더 빠르게 확인해보세요
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
            사진 또는 기본 정보를 바탕으로 피부 타입, 주요 고민, 관심 성분을 정리해드립니다. 이 기능은 의료적 진단이 아닌, K-Beauty 정보 탐색을 돕기 위한 분석 가이드입니다.
          </p>
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
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("photo")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              mode === "photo"
                ? "bg-[#C2185B] text-white"
                : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
            }`}
          >
            사진으로 분석하기
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              mode === "manual"
                ? "bg-[#C2185B] text-white"
                : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
            }`}
          >
            직접 입력해서 시작하기
          </button>
        </div>

        {/* Input + Result */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Left: input */}
          <div className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm">
            {mode === "photo" ? (
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-900">
                  사진 업로드
                </p>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="flex h-56 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-pink-200 bg-pink-50/40 p-4 text-center text-sm text-gray-600"
                  onClick={() => {
                    const input = document.getElementById("file-input");
                    if (input) (input as HTMLInputElement).click();
                  }}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Uploaded preview"
                      className="h-full w-auto rounded-2xl object-cover"
                    />
                  ) : (
                    <div>
                      <p className="mb-1 font-medium text-gray-800">
                        사진을 업로드하세요
                      </p>
                      <p className="text-xs text-gray-500">
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

                <p className="mt-3 text-xs text-gray-500">
                  AI 분석 결과는 참고용 정보이며, 실제 피부 상태와 다를 수 있습니다.
                </p>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleAnalyzePhoto}
                    disabled={!canAnalyzePhoto}
                    className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-xs font-semibold text-white shadow-sm transition ${
                      canAnalyzePhoto
                        ? "bg-[#C2185B] hover:bg-[#a3154f]"
                        : "cursor-not-allowed bg-gray-300"
                    }`}
                  >
                    {loading ? "분석 중..." : "AI 분석 시작"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-900">
                    피부톤
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["밝은", "중간", "어두운"] as ToneKo[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setManualTone(v)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          manualTone === v
                            ? "bg-[#C2185B] text-white"
                            : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-900">
                    언더톤
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["웜톤", "쿨톤", "중립"] as UndertoneKo[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setManualUndertone(v)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          manualUndertone === v
                            ? "bg-[#C2185B] text-white"
                            : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-900">
                    주요 고민
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      ["붉은기", "건조함", "여드름", "칙칙함", "노화방지"] as ConcernKo[]
                    ).map((v) => {
                      const selected = manualConcerns.includes(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            setManualConcerns((prev) => {
                              const next = selected
                                ? prev.filter((x) => x !== v)
                                : [...prev, v];
                              return next.length ? next : ["붉은기"];
                            });
                          }}
                          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                            selected
                              ? "bg-[#C2185B] text-white"
                              : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
                          }`}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-900">
                    민감도
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["민감함", "보통", "강한편"] as SensitivityKo[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setManualSensitivity(v)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          manualSensitivity === v
                            ? "bg-[#C2185B] text-white"
                            : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleAnalyzeManual}
                    disabled={loading}
                    className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-xs font-semibold text-white shadow-sm transition ${
                      loading
                        ? "cursor-not-allowed bg-gray-300"
                        : "bg-[#C2185B] hover:bg-[#a3154f]"
                    }`}
                  >
                    {loading ? "분석 중..." : "AI 분석 시작"}
                  </button>
                  <p className="mt-3 text-xs text-gray-500">
                    AI 분석 결과는 참고용 정보이며, 실제 피부 상태와 다를 수 있습니다.
                  </p>
                </div>
              </div>
            )}

            {error ? <p className="mt-4 text-xs text-red-600">{error}</p> : null}
          </div>

          {/* Right: result */}
          <div className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm">
            {!result ? (
              <p className="text-sm text-gray-500">
                입력 후 AI 분석을 실행하면 피부 타입, 고민, 추천 성분, 루틴 가이드가 표시됩니다.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      피부 타입
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {result.skin_type}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
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
            )}
          </div>
        </section>

        {/* Sprint 3 Phase 1 — LocalStorage 랭킹 제품 표시 (기존 분석 레이아웃 아래) */}
        {rankedProducts.length > 0 ? (
          <section
            className="mt-10 border-t border-pink-100 pt-8"
            aria-label="추천 제품"
          >
            <h2 className="font-['Playfair_Display',serif] text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
              추천 제품
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              분석·매칭 결과 상위 {rankedProducts.length}개 제품입니다. (구매
              링크는 아직 제공하지 않습니다)
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {rankedProducts.map((ranked, index) => (
                <RecommendedProductCard
                  key={ranked.product.id}
                  rank={index + 1}
                  ranked={ranked}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

