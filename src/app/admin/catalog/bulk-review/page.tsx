import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CatalogAutomationShell } from "../CatalogAutomationShell";
import { BulkReviewFilters } from "./BulkReviewFilters";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bulk Catalog Review | K-Beauty Match",
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

export default async function BulkCatalogReviewPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const sp = await searchParams;
  const brand = pick(sp, "brand");
  const domain = pick(sp, "domain");
  const status = pick(sp, "status");
  const missing = pick(sp, "missing"); // inci | image | retailer
  const errorMsg: string | null = null;

  let rows: Array<Record<string, unknown>> = [];
  let stats = {
    total: 0,
    needsReview: 0,
    dataComplete: 0,
    withImage: 0,
    withEvidence: 0,
  };

  try {
    const client = createSupabaseAdminClient();
    let query = client
      .from("catalog_staging_products")
      .select(
        "id, brand_canonical, product_name_ko, product_name_raw, category_canonical, beauty_domain, product_status, ingredients_status, confidence_score, primary_image_url, official_product_url, validation_warnings, evidence_ingredient_slugs, image_rights_status, sprint_tag, created_at"
      )
      .eq("sprint_tag", "full-beauty-20260714")
      .order("confidence_score", { ascending: false })
      .limit(400);

    if (brand.trim()) query = query.ilike("brand_canonical", `%${brand.trim()}%`);
    if (domain.trim()) query = query.eq("beauty_domain", domain.trim());
    if (status.trim()) query = query.eq("product_status", status.trim());

    const { data, error } = await query;
    if (error) throw new AdminConfigurationError(error.message);
    rows = (data ?? []) as Array<Record<string, unknown>>;

    if (missing === "inci") {
      rows = rows.filter((r) => r.ingredients_status === "not_found");
    } else if (missing === "image") {
      rows = rows.filter((r) => !r.primary_image_url);
    }

    stats = {
      total: rows.length,
      needsReview: rows.filter((r) => r.product_status === "needs_review").length,
      dataComplete: rows.filter((r) => r.product_status === "data_complete").length,
      withImage: rows.filter((r) => Boolean(r.primary_image_url)).length,
      withEvidence: rows.filter((r) => {
        const e = r.evidence_ingredient_slugs;
        return Array.isArray(e) && e.length > 0;
      }).length,
    };
  } catch (e) {
    return (
      <CatalogAutomationShell
        title="Bulk review"
        description="대량 검수 — Staging sprint 데이터"
      >
        <p className="text-sm text-red-700">
          {e instanceof AdminConfigurationError
            ? e.message
            : "Staging bulk review unavailable"}
        </p>
      </CatalogAutomationShell>
    );
  }

  return (
    <CatalogAutomationShell
      title="Bulk review"
      description="오류 유형·필터 단위로 검수합니다. 대량 승인은 Staging candidate 상태만 변경하며 공개 verified/publish는 실행하지 않습니다."
    >
      <BulkReviewFilters
        brand={brand}
        domain={domain}
        status={status}
        missing={missing}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-5">
        {[
          ["표시", stats.total],
          ["needs_review", stats.needsReview],
          ["data_complete", stats.dataComplete],
          ["이미지", stats.withImage],
          ["Evidence", stats.withEvidence],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-[#E8DFD8] bg-white px-3 py-2"
          >
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              {label}
            </p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {errorMsg ? <p className="text-sm text-red-700">{errorMsg}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Domain</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Conf</th>
              <th className="px-3 py-2">INCI</th>
              <th className="px-3 py-2">Image</th>
              <th className="px-3 py-2">Warnings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-[#F0E8E2] align-top">
                <td className="px-3 py-2">{String(r.brand_canonical ?? "—")}</td>
                <td className="px-3 py-2">
                  <p className="font-medium">
                    {String(r.product_name_ko ?? r.product_name_raw ?? "—")}
                  </p>
                  {r.official_product_url ? (
                    <a
                      href={String(r.official_product_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#8B4513] underline"
                    >
                      출처
                    </a>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs">
                  {String(r.beauty_domain ?? r.category_canonical ?? "—")}
                </td>
                <td className="px-3 py-2">{String(r.product_status)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.confidence_score == null
                    ? "—"
                    : Number(r.confidence_score).toFixed(2)}
                </td>
                <td className="px-3 py-2">{String(r.ingredients_status)}</td>
                <td className="px-3 py-2">
                  {r.primary_image_url ? "remote" : "missing"}
                </td>
                <td className="px-3 py-2 text-xs text-amber-900">
                  {Array.isArray(r.validation_warnings)
                    ? r.validation_warnings.slice(0, 3).join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CatalogAutomationShell>
  );
}
