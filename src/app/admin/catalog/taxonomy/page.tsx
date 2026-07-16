import { requireAdminUser } from "@/lib/auth/admin";
import {
  BEAUTY_DOMAINS,
  DOMAIN_CATEGORIES,
  normalizeBeautyCategory,
} from "@/lib/catalog/taxonomy";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Taxonomy | K-Beauty Match",
  robots: { index: false, follow: false },
};

const SAMPLE_RAW = [
  "sunscreen",
  "tone up base",
  "lip balm",
  "lipstick",
  "scalp shampoo",
  "hair mask",
  "sheet mask",
  "cushion",
  "shampoo",
  "hair loss shampoo",
  "tone up",
  "mask",
];

export default async function CatalogTaxonomyPage() {
  await requireAdminUser();

  return (
    <CatalogAutomationShell
      title="Beauty taxonomy"
      description="Canonical domains and category aliases. Read-only. Ambiguous raw categories stay needs_review — never invent a category from a search title."
    >
      <div className="mb-6 overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Domain</th>
              <th className="px-3 py-2">Categories</th>
            </tr>
          </thead>
          <tbody>
            {BEAUTY_DOMAINS.map((d) => (
              <tr key={d} className="border-b border-[#F0E8E2] align-top">
                <td className="px-3 py-2 font-medium">{d}</td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {(DOMAIN_CATEGORIES[d] ?? []).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Alias samples</h2>
      <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Raw</th>
              <th className="px-3 py-2">Canonical</th>
              <th className="px-3 py-2">Domain</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Needs review</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_RAW.map((raw) => {
              const n = normalizeBeautyCategory(raw);
              return (
                <tr key={raw} className="border-b border-[#F0E8E2]">
                  <td className="px-3 py-2">{raw}</td>
                  <td className="px-3 py-2">{n.category ?? "—"}</td>
                  <td className="px-3 py-2">{n.domain ?? "—"}</td>
                  <td className="px-3 py-2">{n.confidence}</td>
                  <td className="px-3 py-2">
                    {n.needsReview ? n.reason ?? "yes" : "no"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CatalogAutomationShell>
  );
}
