"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";

type IngredientPageProps = {
  params: Promise<{ slug: string }>;
};

type Study = {
  title: string;
  year: string;
  journal: string;
  url: string;
};

type Ingredient = {
  slug: string;
  name: string;
  benefits: string[];
  mechanism: string;
  studies: Study[];
  disclaimer: string;
  productExample: string;
};

const INGREDIENTS: Ingredient[] = [
  {
    slug: "centella-asiatica",
    name: "Centella Asiatica (시카)",
    benefits: ["Redness Reduction", "Skin Barrier Repair", "Anti-inflammatory"],
    mechanism:
      "Madecassoside in Centella Asiatica inhibits inflammatory signals and promotes collagen synthesis, structurally strengthening the skin barrier.",
    studies: [
      {
        title: "Anti-inflammatory effects of Centella asiatica",
        year: "2021",
        journal: "Journal of Dermatology",
        url: "https://pubmed.ncbi.nlm.nih.gov",
      },
      {
        title: "Wound healing properties of Asiaticoside",
        year: "2019",
        journal: "Skin Pharmacology",
        url: "https://pubmed.ncbi.nlm.nih.gov",
      },
    ],
    disclaimer:
      "This information is for reference only and does not replace medical diagnosis or treatment.",
    productExample: "COSRX Centella Water Toner",
  },
  {
    slug: "niacinamide",
    name: "Niacinamide (나이아신아마이드)",
    benefits: ["Brightening", "Pore Minimizing", "Oil Control"],
    mechanism:
      "Niacinamide inhibits melanin transfer to skin cells, reducing dark spots and evening skin tone.",
    studies: [
      {
        title: "Niacinamide and skin brightening",
        year: "2020",
        journal: "International Journal of Cosmetic Science",
        url: "https://pubmed.ncbi.nlm.nih.gov",
      },
      {
        title: "Effect of niacinamide on sebum production",
        year: "2018",
        journal: "Dermatology Research",
        url: "https://pubmed.ncbi.nlm.nih.gov",
      },
    ],
    disclaimer:
      "This information is for reference only and does not replace medical diagnosis or treatment.",
    productExample: "Some By Mi Niacinamide Serum",
  },
  {
    slug: "hyaluronic-acid",
    name: "Hyaluronic Acid (히알루론산)",
    benefits: ["Deep Hydration", "Plumping", "Barrier Support"],
    mechanism:
      "Hyaluronic acid holds up to 1000x its weight in water, drawing moisture into the skin and maintaining hydration levels.",
    studies: [
      {
        title: "Hyaluronic acid and skin hydration",
        year: "2021",
        journal: "Journal of Clinical Medicine",
        url: "https://pubmed.ncbi.nlm.nih.gov",
      },
      {
        title: "Topical hyaluronic acid efficacy",
        year: "2019",
        journal: "Skin Research and Technology",
        url: "https://pubmed.ncbi.nlm.nih.gov",
      },
    ],
    disclaimer:
      "This information is for reference only and does not replace medical diagnosis or treatment.",
    productExample: "Laneige Water Sleeping Mask",
  },
];

export default function IngredientPage({ params }: IngredientPageProps) {
  const { slug } = use(params);
  const ingredient = INGREDIENTS.find((item) => item.slug === slug);

  if (!ingredient) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C2185B]">
            K-Beauty Ingredient Insight
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {ingredient.name}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2">
            {ingredient.benefits.map((benefit) => (
              <span
                key={benefit}
                className="rounded-full bg-[#C2185B] px-3 py-1 text-xs font-medium text-white"
              >
                {benefit}
              </span>
            ))}
          </div>
        </header>

        {/* Mechanism of action */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gray-700">
            How it works
          </h2>
          <div className="rounded-2xl border border-pink-100 bg-pink-50/60 p-5 text-sm leading-relaxed text-gray-800">
            {ingredient.mechanism}
          </div>
        </section>

        {/* Studies */}
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-700">
            Clinical & Research Studies
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {ingredient.studies.map((study) => (
              <article
                key={study.title}
                className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <p className="mb-2 text-sm font-semibold text-gray-900">
                  {study.title}
                </p>
                <p className="mb-1 text-xs text-gray-500">
                  {study.year} · {study.journal}
                </p>
                <div className="mt-auto pt-3">
                  <Link
                    href={study.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-semibold text-[#C2185B] underline underline-offset-4 hover:text-[#a3154f]"
                  >
                    View on PubMed
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gray-700">
            Important note
          </h2>
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-xs leading-relaxed text-gray-800">
            {ingredient.disclaimer}
          </div>
        </section>

        {/* Related product */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gray-700">
            Where you can find it
          </h2>
          <div className="rounded-2xl border border-pink-100 bg-pink-50/60 p-4 text-sm text-gray-800">
            Commonly featured in{" "}
            <span className="font-semibold text-[#C2185B]">
              {ingredient.productExample}
            </span>{" "}
            and similar K-beauty products.
          </div>
        </section>

        {/* Back button */}
        <footer className="mt-auto border-t border-gray-100 pt-6">
          <Link href="/results">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-white px-5 py-2 text-xs font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Back to Results
            </button>
          </Link>
        </footer>
      </main>
    </div>
  );
}

