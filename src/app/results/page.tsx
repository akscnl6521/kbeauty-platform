"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProductRow = {
  id: string;
  name: string;
  name_ko: string | null;
  brand: string;
  category: string | null;
  skin_concern: string | null;
  skin_tone: string | null;
  key_ingredients: string[] | null;
  price_usd: number | null;
  recommendation_reason: string | null;
  slug: string | null;
};

type CountryCode = "US" | "JP" | "KR" | "OTHER";

type Locale = "en" | "ja";

type Messages = {
  results_title: string;
  view_ingredients: string;
};

const LOCALE_MESSAGES: Record<Locale, Messages> = {
  en: {
    results_title: "Your K-Beauty Matches",
    view_ingredients: "View Ingredients",
  },
  ja: {
    results_title: "あなたへのK-ビューティーおすすめ",
    view_ingredients: "成分を見る",
  },
};

function ingredientNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function buildPurchaseLinks(
  country: CountryCode,
  productNameEn: string,
  productNameKo: string | null
): { label: string; href: string }[] {
  const baseName = country === "KR" && productNameKo ? productNameKo : productNameEn;
  const encodedName = encodeURIComponent(baseName).replace(/%20/g, "+");

  switch (country) {
    case "US":
      return [
        {
          label: "Find on Sephora",
          href: `https://www.sephora.com/search?keyword=${encodedName}`,
        },
        {
          label: "Find on Amazon",
          href: `https://www.amazon.com/s?k=${encodedName}`,
        },
      ];
    case "JP":
      return [
        {
          label: "Qoo10で探す",
          href: `https://www.qoo10.jp/gmkt.inc/Search/Search.aspx?keyword=${encodedName}`,
        },
        {
          label: "Amazon.co.jpで探す",
          href: `https://www.amazon.co.jp/s?k=${encodedName}`,
        },
      ];
    case "KR":
      return [
        {
          label: "올리브영에서 찾기",
          href: `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodedName}`,
        },
        {
          label: "쿠팡에서 찾기",
          href: `https://www.coupang.com/np/search?q=${encodedName}`,
        },
        {
          label: "네이버쇼핑에서 찾기",
          href: `https://search.shopping.naver.com/search/all?query=${encodedName}`,
        },
      ];
    default:
      return [
        {
          label: "Find on YesStyle",
          href: `https://www.yesstyle.com/en/search.html?keyword=${encodedName}`,
        },
      ];
  }
}

export default function ResultsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState<CountryCode>("OTHER");
  const [locale, setLocale] = useState<Locale>("en");

  const messages = LOCALE_MESSAGES[locale];

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error: fetchError } = await supabase
          .from("products")
          .select(
            "id, name, name_ko, brand, category, skin_concern, skin_tone, key_ingredients, price_usd, recommendation_reason, slug"
          )
          .limit(10000);

        if (fetchError) {
          console.error("[Supabase products fetch error]", fetchError);
          setError(fetchError.message);
          return;
        }
        setProducts((data as ProductRow[]) ?? []);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[Supabase products fetch exception]", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  useEffect(() => {
    async function detectCountry() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) return;
        const json = (await res.json()) as { country_code?: string };
        const code = json.country_code;
        if (code === "US") {
          setCountry("US");
        } else if (code === "JP") {
          setCountry("JP");
        } else if (code === "KR") {
          setCountry("KR");
        } else {
          setCountry("OTHER");
        }
      } catch (e) {
        console.error("[ipapi] country detect failed", e);
      }
    }

    detectCountry();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-gray-500">Loading recommendations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/quiz"
          className="text-sm font-semibold text-[#C2185B] underline hover:no-underline"
        >
          Back to Quiz
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C2185B]">
              K-Beauty Recommendations
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {messages.results_title}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`rounded-full px-3 py-1 transition ${
                locale === "en"
                  ? "bg-[#C2185B] text-white"
                  : "border border-pink-200 text-gray-700 hover:bg-pink-50"
              }`}
            >
              🇺🇸
            </button>
            <button
              type="button"
              onClick={() => setLocale("ja")}
              className={`rounded-full px-3 py-1 transition ${
                locale === "ja"
                  ? "bg-[#C2185B] text-white"
                  : "border border-pink-200 text-gray-700 hover:bg-pink-50"
              }`}
            >
              🇯🇵
            </button>
          </div>
        </header>

        {/* Product cards */}
        <section className="flex-1">
          <div className="grid gap-6 md:grid-cols-3">
            {products.map((product) => {
              const keyIngredients = product.key_ingredients ?? [];
              const firstIngredientSlug =
                keyIngredients.length > 0
                  ? ingredientNameToSlug(keyIngredients[0])
                  : null;
              const priceDisplay =
                product.price_usd != null ? `$${product.price_usd}` : null;
              const purchaseLinks = buildPurchaseLinks(
                country,
                product.name,
                product.name_ko
              );

              return (
                <article
                  key={product.id}
                  className="flex h-full flex-col rounded-3xl border border-pink-100 bg-pink-50/40 p-5 shadow-sm"
                >
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#C2185B]">
                    {product.brand}
                  </div>
                  <h2 className="mb-2 text-lg font-semibold text-gray-900">
                    {product.name}
                  </h2>
                  {(product.skin_concern || product.skin_tone) && (
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-500">
                      {[product.skin_concern, product.skin_tone]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  {keyIngredients.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {keyIngredients.map((ingredient) => (
                        <span
                          key={ingredient}
                          className="rounded-full bg-[#C2185B] px-3 py-1 text-xs font-medium text-white"
                        >
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  )}

                  {product.recommendation_reason && (
                    <p className="mb-4 text-sm leading-relaxed text-gray-700">
                      {product.recommendation_reason}
                    </p>
                  )}

                  <div className="mt-auto">
                    {priceDisplay && (
                      <p className="mb-4 text-sm font-semibold text-gray-900">
                        {priceDisplay}
                      </p>
                    )}
                    <div className="flex flex-col gap-2 text-sm sm:flex-row">
                      {purchaseLinks.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center rounded-full bg-[#C2185B] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#a3154f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          {link.label}
                        </a>
                      ))}
                      {firstIngredientSlug ? (
                        <Link
                          href={`/ingredients/${firstIngredientSlug}`}
                          className="inline-flex flex-1 items-center justify-center rounded-full border border-[#C2185B] bg-white px-4 py-2 font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          {messages.view_ingredients}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Footer actions */}
        <footer className="mt-12 flex items-center justify-between border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-500">
            These recommendations are a starting point. Always patch test new
            products.
          </p>
          <Link href="/quiz">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-white px-5 py-2 text-xs font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Start Over
            </button>
          </Link>
        </footer>
      </main>
    </div>
  );
}

