import { requireAdminUser } from "@/lib/auth/admin";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Domain Review | K-Beauty Match",
  robots: { index: false, follow: false },
};

const RISKS = [
  {
    wrong: "lipstick → face_skincare rankProducts",
    correct: "lip_color domain only",
  },
  {
    wrong: "shampoo → face_skincare",
    correct: "scalp_care or hair_care (or needs_review)",
  },
  {
    wrong: "sunscreen scored as color makeup",
    correct: "sun_care domain",
  },
  {
    wrong: "sheet_mask mixed with hair_mask",
    correct: "face_skincare vs hair_care",
  },
  {
    wrong: "cushion vs sun_cushion collapsed",
    correct: "base_makeup vs sun_care",
  },
  {
    wrong: "hair-loss observation → shampoo purchase push",
    correct: "safety triage first; no treatment claims",
  },
  {
    wrong: "expert_first with purchase CTA emphasis",
    correct: "hide purchase CTA / price emphasis",
  },
];

export default async function CatalogDomainReviewPage() {
  await requireAdminUser();

  return (
    <CatalogAutomationShell
      title="Recommendation domain review"
      description="Guards against mixing face, sun, lip, makeup, scalp, hair, and body candidate pools. Read-only checklist."
    >
      <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Mixing risk</th>
              <th className="px-3 py-2">Correct isolation</th>
            </tr>
          </thead>
          <tbody>
            {RISKS.map((r) => (
              <tr key={r.wrong} className="border-b border-[#F0E8E2] align-top">
                <td className="px-3 py-2 text-red-800">{r.wrong}</td>
                <td className="px-3 py-2 text-gray-800">{r.correct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        face rankProducts 점수 공식은 변경하지 않습니다. 후보 필터로 도메인만
        분리합니다.
      </p>
    </CatalogAutomationShell>
  );
}
