"use client";

import Link from "next/link";

type Product = {
  name: string;
  brand: string;
  concerns: string;
  keyIngredients: string[];
  price: string;
  reason: string;
};

const products: Product[] = [
  {
    name: "COSRX Centella Water Alcohol-Free Toner",
    brand: "COSRX",
    concerns: "Redness, Sensitive",
    keyIngredients: ["Centella Asiatica", "Panthenol"],
    price: "$15",
    reason: "Centella Asiatica reduces redness and strengthens skin barrier",
  },
  {
    name: "Some By Mi AHA BHA PHA 30 Days Miracle Toner",
    brand: "Some By Mi",
    concerns: "Acne, Dullness",
    keyIngredients: ["AHA", "BHA", "PHA", "Tea Tree"],
    price: "$18",
    reason: "Triple acid blend gently exfoliates and clears acne",
  },
  {
    name: "Laneige Water Sleeping Mask",
    brand: "Laneige",
    concerns: "Dryness, Dullness",
    keyIngredients: ["Hyaluronic Acid", "Squalane"],
    price: "$25",
    reason: "Intense overnight hydration with hyaluronic acid",
  },
];

export default function ResultsPage() {
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
            {products.map((product) => (
              <article
                key={product.name}
                className="flex h-full flex-col rounded-3xl border border-pink-100 bg-pink-50/40 p-5 shadow-sm"
              >
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#C2185B]">
                  {product.brand}
                </div>
                <h2 className="mb-2 text-lg font-semibold text-gray-900">
                  {product.name}
                </h2>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-500">
                  Concerns: <span className="normal-case">{product.concerns}</span>
                </p>

                <div className="mb-3 flex flex-wrap gap-2">
                  {product.keyIngredients.map((ingredient) => (
                    <span
                      key={ingredient}
                      className="rounded-full bg-[#C2185B] px-3 py-1 text-xs font-medium text-white"
                    >
                      {ingredient}
                    </span>
                  ))}
                </div>

                <p className="mb-4 text-sm leading-relaxed text-gray-700">
                  {product.reason}
                </p>

                <div className="mt-auto">
                  <p className="mb-4 text-sm font-semibold text-gray-900">
                    {product.price}
                  </p>
                  <div className="flex flex-col gap-2 text-sm sm:flex-row">
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center rounded-full bg-[#C2185B] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#a3154f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      Find This Product
                    </button>
                    <Link
                      href={
                        product.name.startsWith("COSRX")
                          ? "/ingredients/centella-asiatica"
                          : product.name.startsWith("Some By Mi")
                          ? "/ingredients/niacinamide"
                          : "/ingredients/hyaluronic-acid"
                      }
                      className="inline-flex flex-1 items-center justify-center rounded-full border border-[#C2185B] bg-white px-4 py-2 font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      View Ingredients
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Footer actions */}
        <footer className="mt-12 flex items-center justify-between border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-500">
            These recommendations are a starting point. Always patch test new products.
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

