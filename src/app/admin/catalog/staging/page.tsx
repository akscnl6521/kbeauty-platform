import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getStagingDataKindCounts,
  listStagingProducts,
} from "@/lib/admin/catalog-automation";
import { CatalogAutomationShell } from "../CatalogAutomationShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Staging | K-Beauty Match",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = sp[key];
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export default async function CatalogStagingPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const sp = await searchParams;
  const dataKindRaw = pick(sp, "kind");
  const dataKind =
    dataKindRaw === "fixture" || dataKindRaw === "real" || dataKindRaw === "all"
      ? dataKindRaw
      : "all";
  const brand = pick(sp, "brand");
  const category = pick(sp, "category");
  const ingredientsStatus = pick(sp, "ingredients");

  let rows: Awaited<ReturnType<typeof listStagingProducts>> = [];
  let counts = { real: 0, fixture: 0, total: 0 };
  let errorMsg: string | null = null;
  try {
    rows = await listStagingProducts({
      dataKind,
      brand,
      category,
      ingredientsStatus,
      limit: 200,
    });
    counts = await getStagingDataKindCounts();
  } catch (e) {
    errorMsg =
      e instanceof AdminConfigurationError ? e.message : "Staging unavailable";
  }

  return (
    <CatalogAutomationShell
      title="Staging products"
      description="검증 전 스테이징 제품입니다. fixture는 테스트 데이터로 분리되며 products 승격이 금지됩니다. 실수집은 Preview 전용 staging DB에서만 허용됩니다."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">
            Real
          </p>
          <p className="mt-1 text-2xl font-semibold">{counts.real}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-amber-800">
            Fixture / test
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-950">
            {counts.fixture}
          </p>
        </div>
        <div className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">
            Total
          </p>
          <p className="mt-1 text-2xl font-semibold">{counts.total}</p>
        </div>
      </div>

      <form
        method="get"
        className="mb-4 grid gap-3 rounded-xl border border-[#E8DFD8] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="text-xs text-gray-600">
          데이터 종류
          <select
            name="kind"
            defaultValue={dataKind}
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
          >
            <option value="all">전체</option>
            <option value="real">실제만</option>
            <option value="fixture">fixture/테스트만</option>
          </select>
        </label>
        <label className="text-xs text-gray-600">
          브랜드
          <input
            name="brand"
            defaultValue={brand}
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            placeholder="COSRX"
          />
        </label>
        <label className="text-xs text-gray-600">
          카테고리
          <input
            name="category"
            defaultValue={category}
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            placeholder="serum"
          />
        </label>
        <label className="text-xs text-gray-600">
          성분 상태
          <input
            name="ingredients"
            defaultValue={ingredientsStatus}
            className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            placeholder="source_verified"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded bg-[#8B6914] px-3 py-2 text-sm font-medium text-white"
          >
            필터
          </button>
        </div>
      </form>

      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}
      {!errorMsg && rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          표시할 스테이징 행이 없습니다. 실제 수집은 staging DB 분리 후
          재개합니다.
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Brand</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Ingredients</th>
                <th className="px-3 py-2">Official URL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const fixture = Boolean(r.is_fixture) || Boolean(r.test_only);
                return (
                  <tr
                    key={String(r.id)}
                    className="border-b border-[#F0E8E2] align-top"
                  >
                    <td className="px-3 py-2">
                      {fixture ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                          테스트 데이터
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">실제</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {String(r.brand_canonical ?? r.brand_raw)}
                    </td>
                    <td className="px-3 py-2">{String(r.product_name_raw)}</td>
                    <td className="px-3 py-2">
                      {String(r.category_canonical ?? "—")}
                    </td>
                    <td className="px-3 py-2">
                      {r.size_value != null
                        ? `${r.size_value} ${r.size_unit ?? ""}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{String(r.product_status)}</td>
                    <td className="px-3 py-2">
                      {String(r.ingredients_status)}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-xs">
                      {String(r.official_product_url ?? "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </CatalogAutomationShell>
  );
}
