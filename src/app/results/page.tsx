"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProductRow = {
  id: string;
  name: string;
  brand: string;
  category: string | null;
  skin_concern: string | null;
  skin_tone: string | null;
  key_ingredients: string[] | null;
  price_usd: number | null;
  recommendation_reason: string | null;
  where_to_find_us: string | null;
  where_to_find_jp: string | null;
  slug: string | null;
};

function ingredientNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function ResultsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error: fetchError } = await supabase
          .from("products")
          .select(
            "id, name, brand, category, skin_concern, skin_tone, key_ingredients, price_usd, recommendation_reason, where_to_find_us, where_to_find_jp, slug"
          )
          .limit(10000);

        if (fetchError) {
          setError(fetchError.message);
          return;
        }
        setProducts((data as ProductRow[]) ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
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
              Your K-Beauty Matches
            </h1>
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
                product.price_usd != null
                  ? `$${product.price_usd}`
                  : null;

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
                      {[
                        product.skin_concern,
                        product.skin_tone,
                      ]
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
                      {product.where_to_find_us && (
                        <a
                          href={product.where_to_find_us}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center rounded-full bg-[#C2185B] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#a3154f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          Find This Product
                        </a>
                      )}
                      {firstIngredientSlug ? (
                        <Link
                          href={`/ingredients/${firstIngredientSlug}`}
                          className="inline-flex flex-1 items-center justify-center rounded-full border border-[#C2185B] bg-white px-4 py-2 font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          View Ingredients
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
