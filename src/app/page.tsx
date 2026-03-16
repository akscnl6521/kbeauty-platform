import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="text-lg font-semibold tracking-[0.2em] text-[#C2185B]">
            KBEAUTY GUIDE
          </div>
        </header>

        {/* Hero Section */}
        <section className="mt-20 flex flex-1 flex-col items-start justify-center gap-8 md:mt-28 md:flex-row md:items-center md:gap-16">
          <div className="max-w-xl space-y-6">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#C2185B]">
              K-Beauty Discovery Platform
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Find Your Perfect
              <span className="block text-[#C2185B]">K-Beauty Match</span>
            </h1>
            <p className="text-base leading-relaxed text-gray-600 md:text-lg">
              Personalized recommendations based on your skin tone, concerns, and budget.
              Discover Korean skincare routines, product matches, and routines curated just for you.
            </p>
            <div className="mt-4">
              <Link href="/quiz">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#C2185B33] transition hover:bg-[#a3154f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Find My Skincare
                </button>
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="rounded-full bg-pink-50 px-4 py-1 text-[#C2185B]">
                Skin tone & concern matching
              </span>
              <span className="rounded-full bg-pink-50 px-4 py-1 text-[#C2185B]">
                K-beauty routines by budget
              </span>
            </div>
          </div>

          {/* Right side simple visual placeholder */}
          <div className="mt-10 w-full max-w-sm md:mt-0">
            <div className="relative rounded-3xl border border-pink-100 bg-pink-50/60 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#C2185B]">
                Preview
              </div>
              <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Skin Type</span>
                  <span className="rounded-full bg-pink-50 px-3 py-1 text-[11px] font-medium text-[#C2185B]">
                    Combination · Sensitive
                  </span>
                </div>
                <div className="h-px bg-pink-100" />
                <div className="space-y-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-900">Tonight&apos;s K-Beauty routine</p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>Low pH gel cleanser</li>
                    <li>Hydrating toner with panthenol</li>
                    <li>Niacinamide + barrier serum</li>
                    <li>Ceramide cream moisturizer</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <footer className="mt-16 border-t border-gray-100 pt-6 text-xs text-gray-400">
          Powered by K-beauty ingredients, routines, and real user data.
        </footer>
      </main>
    </div>
  );
}
