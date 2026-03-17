"use client";

import Head from "next/head";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useLocale } from "@/hooks/useLocale";
import { supabase } from "@/lib/supabase";

type IngredientPageProps = {
  params: Promise<{ slug: string }>;
};

type Locale = "en" | "ja" | "ko";

type IngredientRow = {
  slug: string;
  name_en: string;
  name_ko: string | null;
  name_ja: string | null;
  effects: string[] | null;
  effects_ko: string[] | null;
  effects_ja: string[] | null;
  mechanism: string | null;
  mechanism_ja: string | null;
  mechanism_ko: string | null;
  caution: string | null;
  caution_ko: string | null;
  caution_ja: string | null;
  paper_1_title: string | null;
  paper_1_year: string | null;
  paper_1_journal: string | null;
  paper_1_url: string | null;
  paper_2_title: string | null;
  paper_2_year: string | null;
  paper_2_journal: string | null;
  paper_2_url: string | null;
};

const INGREDIENT_PAGE_LABELS: Record<
  Locale,
  {
    howItWorks: string;
    clinicalResearch: string;
    viewOnPubmed: string;
    importantNotice: string;
    foundIn: string;
    backToResults: string;
  }
> = {
  en: {
    howItWorks: "How it works",
    clinicalResearch: "Clinical & Research Studies",
    viewOnPubmed: "View on PubMed",
    importantNotice: "Important note",
    foundIn: "Found In",
    backToResults: "Back to Results",
  },
  ja: {
    howItWorks: "作用メカニズム",
    clinicalResearch: "臨床研究",
    viewOnPubmed: "PubMedで見る",
    importantNotice: "注意事項",
    foundIn: "この成分が入った製品",
    backToResults: "結果に戻る",
  },
  ko: {
    howItWorks: "작용 원리",
    clinicalResearch: "임상 연구",
    viewOnPubmed: "PubMed에서 보기",
    importantNotice: "주의사항",
    foundIn: "이 성분이 들어간 제품",
    backToResults: "결과로 돌아가기",
  },
};

function displayIngredientName(
  row: IngredientRow,
  locale: Locale
): string {
  if (locale === "ko" && row.name_ko) return row.name_ko;
  if (locale === "ja" && row.name_ja) return row.name_ja;
  return row.name_en;
}

export default function IngredientPage({ params }: IngredientPageProps) {
  const { slug } = use(params);
  const { locale } = useLocale();
  const [ingredient, setIngredient] = useState<IngredientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const labels = INGREDIENT_PAGE_LABELS[locale];

  useEffect(() => {
    async function fetchIngredient() {
      try {
        const { data, error: fetchError } = await supabase
          .from("ingredients")
          .select(
            "slug, name_en, name_ko, name_ja, effects, effects_ko, effects_ja, mechanism, mechanism_ja, mechanism_ko, caution, caution_ko, caution_ja, paper_1_title, paper_1_year, paper_1_journal, paper_1_url, paper_2_title, paper_2_year, paper_2_journal, paper_2_url"
          )
          .eq("slug", slug)
          .maybeSingle();

        if (fetchError) {
          console.error("[Supabase ingredients fetch error]", fetchError);
          setError(fetchError.message);
          return;
        }

        setIngredient((data as IngredientRow | null) ?? null);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[Supabase ingredients fetch exception]", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchIngredient();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white font-sans text-gray-900">
        <p className="text-sm text-gray-500">Loading ingredient...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white font-sans text-gray-900 px-6">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/results"
          className="text-xs font-semibold text-[#C2185B] underline hover:no-underline"
        >
          {labels.backToResults}
        </Link>
      </div>
    );
  }

  if (!ingredient) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-900">
        <Head>
          <title>K-Beauty Ingredient Guide | KBEAUTY GUIDE</title>
          <meta
            name="description"
            content="This ingredient information is being prepared. Check back soon for detailed K-beauty science and research."
          />
        </Head>
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C2185B]">
              K-Beauty Ingredient Insight
            </p>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
              이 성분 정보는 준비 중입니다
            </h1>
            <p className="mt-3 text-sm text-gray-600">
              We&apos;re currently preparing detailed information for this
              ingredient. Please check back soon.
            </p>
          </header>

          <section className="mb-10 rounded-2xl border border-pink-100 bg-pink-50/60 p-5 text-sm text-gray-700">
            <p>
              If you discovered this ingredient through a product on our
              platform, the detailed science, clinical papers, and K-beauty use
              cases will be added here shortly.
            </p>
          </section>

          <footer className="mt-auto border-t border-gray-100 pt-6">
            <Link href="/results">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-white px-5 py-2 text-xs font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {labels.backToResults}
              </button>
            </Link>
          </footer>
        </main>
      </div>
    );
  }

  const displayName = displayIngredientName(ingredient, locale);
  // effects 배지: ko → effects_ko, ja → effects_ja, 그 외 → 영문 effects
  const effects =
    locale === "ko" && ingredient.effects_ko?.length
      ? ingredient.effects_ko
      : locale === "ja" && ingredient.effects_ja?.length
        ? ingredient.effects_ja
        : (ingredient.effects ?? []);
  const displayMechanism =
    locale === "ko" && ingredient.mechanism_ko
      ? ingredient.mechanism_ko
      : locale === "ja" && ingredient.mechanism_ja
        ? ingredient.mechanism_ja
        : ingredient.mechanism;
  // 주의사항: ko → caution_ko, ja → caution_ja, 그 외 → 영문 caution
  const displayCaution =
    locale === "ko" && ingredient.caution_ko
      ? ingredient.caution_ko
      : locale === "ja" && ingredient.caution_ja
        ? ingredient.caution_ja
        : ingredient.caution;

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Head>
        <title>{`${displayName} | K-Beauty Ingredient Guide`}</title>
        {(displayMechanism ?? ingredient.mechanism) && (
          <meta
            name="description"
            content={displayMechanism ?? ingredient.mechanism ?? ""}
          />
        )}
      </Head>
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C2185B]">
            K-Beauty Ingredient Insight
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {displayName}
          </h1>

          {effects.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {effects.map((effect) => (
                <span
                  key={effect}
                  className="rounded-full bg-[#C2185B] px-3 py-1 text-xs font-medium text-white"
                >
                  {effect}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Mechanism of action */}
        {displayMechanism && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gray-700">
              {labels.howItWorks}
            </h2>
            <div className="rounded-2xl border border-pink-100 bg-pink-50/60 p-5 text-sm leading-relaxed text-gray-800">
              {displayMechanism}
              {locale === "ko" && !ingredient.mechanism_ko && ingredient.mechanism && (
                <p className="mt-2 text-xs text-gray-500">
                  (영문으로 제공됩니다)
                </p>
              )}
            </div>
          </section>
        )}

        {/* Studies */}
        {(ingredient.paper_1_title || ingredient.paper_2_title) && (
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-700">
              {labels.clinicalResearch}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {ingredient.paper_1_title && (
                <article className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-sm font-semibold text-gray-900">
                    {ingredient.paper_1_title}
                  </p>
                  <p className="mb-1 text-xs text-gray-500">
                    {ingredient.paper_1_year} · {ingredient.paper_1_journal}
                  </p>
                  {ingredient.paper_1_url && (
                    <div className="mt-auto pt-3">
                      <Link
                        href={ingredient.paper_1_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-semibold text-[#C2185B] underline underline-offset-4 hover:text-[#a3154f]"
                      >
                        {labels.viewOnPubmed}
                      </Link>
                    </div>
                  )}
                </article>
              )}

              {ingredient.paper_2_title && (
                <article className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-sm font-semibold text-gray-900">
                    {ingredient.paper_2_title}
                  </p>
                  <p className="mb-1 text-xs text-gray-500">
                    {ingredient.paper_2_year} · {ingredient.paper_2_journal}
                  </p>
                  {ingredient.paper_2_url && (
                    <div className="mt-auto pt-3">
                      <Link
                        href={ingredient.paper_2_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-semibold text-[#C2185B] underline underline-offset-4 hover:text-[#a3154f]"
                      >
                        {labels.viewOnPubmed}
                      </Link>
                    </div>
                  )}
                </article>
              )}
            </div>
          </section>
        )}

        {/* Caution */}
        {displayCaution && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gray-700">
              {labels.importantNotice}
            </h2>
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-xs leading-relaxed text-gray-800">
              {displayCaution}
            </div>
          </section>
        )}

        {/* Back button */}
        <footer className="mt-auto border-t border-gray-100 pt-6">
          <Link href="/results">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-white px-5 py-2 text-xs font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {labels.backToResults}
            </button>
          </Link>
        </footer>
      </main>
    </div>
  );
}

