import { readFileSync } from "node:fs";
import path from "node:path";
import { requireAdminUser } from "@/lib/auth/admin";
import { CatalogAutomationShell } from "../CatalogAutomationShell";
import type { OfficialInciLabelSheet } from "@/lib/catalog/labels";
import { validateOfficialInciLabelSheet } from "@/lib/catalog/labels";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Official INCI Label Sheet | K-Beauty Match",
  robots: { index: false, follow: false },
};

function loadSheet(): {
  sheet: OfficialInciLabelSheet | null;
  error: string | null;
} {
  try {
    const p = path.join(
      process.cwd(),
      "data/catalog/labels/official-inci-sheet.v1.json"
    );
    const sheet = JSON.parse(readFileSync(p, "utf8")) as OfficialInciLabelSheet;
    const v = validateOfficialInciLabelSheet(sheet);
    if (!v.ok) {
      return {
        sheet,
        error: v.issues.map((i) => `${i.externalProductId ?? ""}:${i.code}`).join(", "),
      };
    }
    return { sheet, error: null };
  } catch (e) {
    return {
      sheet: null,
      error: e instanceof Error ? e.message : "load failed",
    };
  }
}

export default async function CatalogLabelsPage() {
  await requireAdminUser();
  const { sheet, error } = loadSheet();
  const applyReady = sheet?.entries.filter((e) => e.applyReady).length ?? 0;

  return (
    <CatalogAutomationShell
      title="Official INCI label sheet"
      description="수동·공식 출처에서 복사한 전성분만 보관합니다. 비어 있으면 적용하지 않으며, 추측으로 채우지 않습니다. Staging 반영: npm run catalog:labels"
    >
      {error ? (
        <p className="mb-4 text-sm text-red-700">시트 오류: {error}</p>
      ) : null}
      {!sheet ? (
        <p className="text-sm text-gray-600">
          시트 파일이 없습니다. `npm run catalog:labels:build` 후 다시 열어주세요.
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#E8DFD8] bg-white p-3 text-sm">
              <p className="text-xs uppercase text-gray-500">Entries</p>
              <p className="text-xl font-semibold">{sheet.entries.length}</p>
            </div>
            <div className="rounded-xl border border-[#E8DFD8] bg-white p-3 text-sm">
              <p className="text-xs uppercase text-gray-500">applyReady</p>
              <p className="text-xl font-semibold">{applyReady}</p>
            </div>
            <div className="rounded-xl border border-[#E8DFD8] bg-white p-3 text-sm">
              <p className="text-xs uppercase text-gray-500">Sprint</p>
              <p className="text-sm font-medium">{sheet._meta.sprintTagDefault}</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Checked</th>
                  <th className="px-3 py-2">INCI #</th>
                  <th className="px-3 py-2">Ready</th>
                </tr>
              </thead>
              <tbody>
                {sheet.entries.map((e) => (
                  <tr
                    key={e.externalProductId}
                    className="border-b border-[#F0E8E2]"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{e.externalProductId}</div>
                      <div className="text-xs text-gray-500">
                        {e.productNameEn ?? e.brandCanonical}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{e.sourceType}</div>
                      <a
                        href={e.sourceUrl}
                        className="text-xs text-[#8B6914] underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        source
                      </a>
                    </td>
                    <td className="px-3 py-2">{e.labelCheckedAt}</td>
                    <td className="px-3 py-2">
                      {e.fullIngredients?.length ??
                        (e.fullIngredientsRaw
                          ? e.fullIngredientsRaw.split(",").length
                          : 0)}
                    </td>
                    <td className="px-3 py-2">
                      {e.applyReady ? "yes" : "no"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </CatalogAutomationShell>
  );
}
