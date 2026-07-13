import { requireAdminUser } from "@/lib/auth/admin";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Variants | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function CatalogVariantsPage() {
  await requireAdminUser();

  return (
    <CatalogAutomationShell
      title="Product variants"
      description="Shade / size / scent variants. Shade-specific ingredients stay scoped — never merge into one INCI list. Read-only until staging DB."
    >
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        색조 추천은 공식 swatch가 없으면 정확도 경고. color_hex는 보조값이며 공식
        색상으로 단정하지 않습니다.
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
        <li>variant_type: shade / size / scent / pack / formula</li>
        <li>ingredient_scope: common / variant_specific / may_contain / unknown</li>
        <li>lip_color · base_makeup · color_makeup · eye_makeup는 shade 데이터 권장</li>
        <li>모델 피부톤 이미지를 자동 피부색 분류에 사용하지 않음</li>
      </ul>
      <p className="mt-4 text-sm text-gray-600">표시할 variant 행이 없습니다.</p>
    </CatalogAutomationShell>
  );
}
