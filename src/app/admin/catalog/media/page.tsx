import { requireAdminUser } from "@/lib/auth/admin";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Media | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function CatalogMediaPage() {
  await requireAdminUser();

  return (
    <CatalogAutomationShell
      title="Product media"
      description="Official product images only. Staging media rows are empty until a separate staging Supabase is connected. Read-only — no remote fetch on shared Production."
    >
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Shared Production DB에는 media insert·실이미지 fetch를 실행하지 않습니다.
        migration 파일만 준비되어 있습니다.
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
        <li>Tier 1: 브랜드 공식 제품 페이지 / CDN</li>
        <li>Tier 2: 승인된 공인 판매처·파트너 피드</li>
        <li>금지: 검색엔진 이미지, UGC, AI 생성 이미지, 워터마크 제거</li>
        <li>usage_rights 불명확 → external_link_only 또는 needs_review</li>
        <li>Storage 복제는 licensed_copy_allowed일 때만</li>
        <li>broken URL → fallback “제품 이미지 준비 중” (다른 제품 이미지 대체 금지)</li>
      </ul>
      <p className="mt-4 text-sm text-gray-600">표시할 media 행이 없습니다.</p>
    </CatalogAutomationShell>
  );
}
