import { requireAdminUser } from "@/lib/auth/admin";
import { CatalogAutomationShell } from "../CatalogAutomationShell";
import { resolveEntryTokens } from "@/lib/catalog/labels";
import { loadOfficialInciSheetFromDisk } from "@/lib/admin/catalogLabelSheetDisk";
import {
  LabelReviewActions,
  type LabelRow,
} from "./LabelReviewActions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Official INCI Label Sheet | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function CatalogLabelsPage() {
  await requireAdminUser();
  let rows: LabelRow[] = [];
  let sprintTag = "full-beauty-20260714";
  let error: string | null = null;
  let applyReady = 0;
  let needsReview = 0;

  try {
    const sheet = loadOfficialInciSheetFromDisk();
    sprintTag = sheet._meta.sprintTagDefault;
    rows = sheet.entries.map((e) => {
      const inciCount = resolveEntryTokens(e).length;
      return {
        externalProductId: e.externalProductId,
        brandCanonical: e.brandCanonical,
        productNameEn: e.productNameEn,
        sourceType: e.sourceType,
        sourceUrl: e.sourceUrl,
        labelCheckedAt: e.labelCheckedAt,
        inciCount,
        applyReady: e.applyReady,
        notes: e.notes,
      };
    });
    applyReady = rows.filter((r) => r.applyReady).length;
    needsReview = rows.filter((r) => !r.applyReady && r.inciCount >= 3).length;
  } catch (e) {
    error = e instanceof Error ? e.message : "load failed";
  }

  return (
    <CatalogAutomationShell
      title="Official INCI label sheet"
      description="수동·공식 출처에서 복사한 전성분만 보관합니다. 검수 후 Staging에만 적용합니다. 공개 verified 자동 승격 없음. 시트 applyReady 승격은 Git 커밋으로 동기화하세요."
    >
      {error ? (
        <p className="mb-4 text-sm text-red-700">시트 오류: {error}</p>
      ) : null}
      {!error && rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          시트 파일이 없습니다. `npm run catalog:labels:build` 후 다시 열어주세요.
        </p>
      ) : null}
      {!error && rows.length > 0 ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#E8DFD8] bg-white p-3 text-sm">
              <p className="text-xs uppercase text-gray-500">Entries</p>
              <p className="text-xl font-semibold">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-[#E8DFD8] bg-white p-3 text-sm">
              <p className="text-xs uppercase text-gray-500">applyReady</p>
              <p className="text-xl font-semibold">{applyReady}</p>
            </div>
            <div className="rounded-xl border border-[#E8DFD8] bg-white p-3 text-sm">
              <p className="text-xs uppercase text-gray-500">Needs review</p>
              <p className="text-xl font-semibold">{needsReview}</p>
            </div>
            <div className="rounded-xl border border-[#E8DFD8] bg-white p-3 text-sm">
              <p className="text-xs uppercase text-gray-500">Sprint</p>
              <p className="text-sm font-medium">{sprintTag}</p>
            </div>
          </div>
          <LabelReviewActions rows={rows} sprintTag={sprintTag} />
        </>
      ) : null}
    </CatalogAutomationShell>
  );
}
