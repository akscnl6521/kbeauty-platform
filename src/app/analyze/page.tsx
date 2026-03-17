"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/hooks/useLocale";

type Locale = "en" | "ja" | "ko";

type AnalysisResult = {
  skin_tone: string;
  concerns: string[];
  ingredients: string[];
  summary_en: string;
  summary_ko: string;
  summary_ja: string;
};

const ANALYZE_TITLE: Record<Locale, string> = {
  en: "AI Skin Analysis",
  ko: "AI 피부 분석",
  ja: "AI肌分析",
};

const UPLOAD_LABEL: Record<Locale, string> = {
  en: "Upload your photo",
  ko: "사진을 업로드하세요",
  ja: "写真をアップロード",
};

const ANALYZING_LABEL: Record<Locale, string> = {
  en: "Analyzing your skin...",
  ko: "피부 분석 중...",
  ja: "分析中...",
};

const RECOMMEND_BUTTON_LABEL: Record<Locale, string> = {
  en: "Get Recommendations",
  ko: "맞춤 제품 추천받기",
  ja: "おすすめ製品を見る",
};

function mapConcernToParam(concern: string): string {
  const c = concern.trim().toLowerCase();
  if (c.includes("redness")) return "Redness";
  if (c.includes("dry")) return "Dryness";
  if (c.includes("acne") || c.includes("blemish")) return "Acne";
  if (c.includes("dull")) return "Dullness";
  if (c.includes("aging") || c.includes("ageing") || c.includes("wrinkle"))
    return "Anti-aging";
  return concern;
}

export default function AnalyzePage() {
  const { locale } = useLocale();
  const router = useRouter();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

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

  const handleAnalyze = async () => {
    if (!imageBase64) {
      setError("Please upload an image first.");
      return;
    }
    if (!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY) {
      setError("Anthropic API key is not configured.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY as string,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system:
            "You are a K-beauty skincare expert. Analyze the skin in the photo and respond ONLY in JSON format like this: {\"skin_tone\": \"light|medium|dark\", \"concerns\": [\"Redness\"|\"Dryness\"|\"Acne\"|\"Dullness\"|\"Anti-aging\"], \"ingredients\": [\"ingredient1\", \"ingredient2\"], \"summary_en\": \"English summary\", \"summary_ko\": \"Korean summary\", \"summary_ja\": \"Japanese summary\"}",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this skin photo according to the system instructions.",
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
        }),
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

      let parsed: AnalysisResult | null = null;
      try {
        parsed = JSON.parse(contentText);
      } catch {
        const match = contentText.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        }
      }

      if (!parsed) {
        throw new Error("Failed to parse analysis result.");
      }

      setResult(parsed);
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
    const tone = result.skin_tone?.toLowerCase();
    if (tone === "light" || tone === "medium" || tone === "dark") {
      // results 페이지는 "Light|Medium|Dark" 형태를 기대하므로 첫 글자만 대문자로 변환
      params.set("tone", tone.charAt(0).toUpperCase() + tone.slice(1));
    }
    if (result.concerns && result.concerns.length > 0) {
      const primary = mapConcernToParam(result.concerns[0]);
      params.set("concern", primary);
    }
    router.push(`/results?${params.toString()}`);
  };

  const canAnalyze = !!imageBase64 && !loading;

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Head>
        <title>{`${ANALYZE_TITLE[locale]} | KBEAUTY GUIDE`}</title>
        <meta
          name="description"
          content="AI-powered K-beauty skin analysis and ingredient recommendations."
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C2185B]">
              AI K-Beauty
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {ANALYZE_TITLE[locale]}
            </h1>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-[#C2185B] underline hover:no-underline"
          >
            ← Home
          </Link>
        </header>

        <section className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Upload column */}
          <div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex h-52 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-pink-200 bg-pink-50/40 p-4 text-center text-sm text-gray-600"
              onClick={() => {
                const input = document.getElementById("file-input");
                if (input) {
                  (input as HTMLInputElement).click();
                }
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
                    {UPLOAD_LABEL[locale]}
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG 또는 PNG 파일을 드래그하거나 클릭해서 업로드하세요.
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

            <div className="mt-4">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-white shadow-sm transition ${
                  canAnalyze
                    ? "bg-[#C2185B] hover:bg-[#a3154f]"
                    : "cursor-not-allowed bg-gray-300"
                }`}
              >
                {loading ? ANALYZING_LABEL[locale] : ANALYZE_TITLE[locale]}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>

          {/* Result column */}
          <div className="rounded-3xl border border-pink-100 bg-pink-50/40 p-5 text-sm">
            {!result ? (
              <p className="text-gray-500">
                {locale === "ko"
                  ? "사진을 업로드하고 AI 분석을 실행하면 피부톤, 고민, 추천 성분이 여기 표시됩니다."
                  : locale === "ja"
                    ? "写真をアップロードしてAI分析を実行すると、肌トーン・悩み・おすすめ成分がここに表示されます。"
                    : "Upload a photo and run AI analysis to see your skin tone, concerns, and recommended ingredients here."}
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                    Skin Tone
                  </h2>
                  <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-800">
                    {result.skin_tone}
                  </span>
                </div>

                {result.concerns?.length > 0 && (
                  <div>
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      Skin Concerns
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {result.concerns.map((c, idx) => (
                        <span
                          key={idx}
                          className="inline-flex rounded-full bg-[#C2185B] px-3 py-1 text-xs font-medium text-white"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.ingredients?.length > 0 && (
                  <div>
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                      Recommended Ingredients
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {result.ingredients.map((ing, idx) => (
                        <span
                          key={idx}
                          className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-[#C2185B]"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700">
                    Summary
                  </h2>
                  <p className="text-sm leading-relaxed text-gray-800">
                    {locale === "ko"
                      ? result.summary_ko
                      : locale === "ja"
                        ? result.summary_ja
                        : result.summary_en}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={goToResults}
                    disabled={!result}
                    className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-6 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#a3154f]"
                  >
                    {RECOMMEND_BUTTON_LABEL[locale]}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

