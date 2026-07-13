import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  filterCatalogAuditProducts,
  loadCatalogAuditReport,
} from "@/lib/admin/catalog-audit";
import {
  catalogTrustStatusLabelKo,
  type CatalogTrustStatus,
} from "@/lib/catalog/catalogAudit";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Catalog Audit | K-Beauty Match",
  robots: { index: false, follow: false },
};

const STATUS_OPTIONS: Array<{ value: "" | CatalogTrustStatus; label: string }> =
  [
    { value: "", label: "전체 상태" },
    { value: "verified_ready", label: "verified_ready" },
    { value: "product_verified_no_offer", label: "product_verified_no_offer" },
    { value: "offer_pending", label: "offer_pending" },
    { value: "product_info_incomplete", label: "product_info_incomplete" },
    { value: "duplicate_candidate", label: "duplicate_candidate" },
    { value: "manual_review", label: "manual_review" },
  ];

function buildHref(params: Record<string, string>, overrides: Record<string, string> = {}) {
  const next = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `/admin/catalog?${s}` : "/admin/catalog";
}

function formatPrice(price: number | null): string {
  if (price == null || !Number.isFinite(price) || price <= 0) return "—";
  return `₩${price.toLocaleString("ko-KR")}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCatalogPage({ searchParams }: PageProps) {
  await requireAdminUser();

  const sp = await searchParams;
  const pick = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };

  const status = pick("status");
  const brand = pick("brand");
  const search = pick("search");
  const productId = pick("id");
  const priority = pick("priority");
  const detailId = pick("detail");

  let report;
  try {
    report = await loadCatalogAuditReport();
  } catch (error) {
    if (error instanceof AdminConfigurationError) {
      return (
        <main className="min-h-screen bg-[#FAF7F5] px-4 py-10">
          <p className="text-sm text-red-700">카탈로그 감사를 불러올 수 없습니다.</p>
        </main>
      );
    }
    throw error;
  }

  const filterParams = { status, brand, search, productId, priority };
  const filtered = filterCatalogAuditProducts(report, filterParams);
  const detail = detailId
    ? report.products.find((p) => p.id === detailId) ?? null
    : null;

  const exportQs = new URLSearchParams();
  if (status) exportQs.set("status", status);
  if (brand) exportQs.set("brand", brand);
  if (search) exportQs.set("search", search);
  if (productId) exportQs.set("id", productId);
  if (priority) exportQs.set("priority", priority);
  const exportHref = `/api/admin/catalog/export${
    exportQs.toString() ? `?${exportQs.toString()}` : ""
  }`;

  const { summary } = report;
  const baseParams: Record<string, string> = {
    status,
    brand,
    search,
    id: productId,
    priority,
  };

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B6914]">
              Read-only · Catalog audit
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              카탈로그 검수
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              제품·판매처 신뢰 상태를 조회만 합니다. DB 수정·삭제·병합은 이
              화면에서 제공하지 않습니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AdminLogoutButton />
          </div>
        </div>
        <AdminSubnav current="catalog" />

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["전체 제품", summary.totalProducts],
            ["verified ready", summary.byStatus.verified_ready],
            ["판매처 없음(검증제품)", summary.byStatus.product_verified_no_offer],
            ["정보 불완전", summary.byStatus.product_info_incomplete],
            ["중복 후보 제품", summary.duplicateCandidateProducts],
            ["strict KR offer", summary.strictKrOffers],
            ["strict US offer", summary.strictUsOffers],
            ["strict JP offer", summary.strictJpOffers],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-3"
            >
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <form
          method="get"
          className="mb-4 grid gap-3 rounded-xl border border-[#E8DFD8] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          <label className="text-xs text-gray-600">
            상태
            <select
              name="status"
              defaultValue={status}
              className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            브랜드
            <input
              name="brand"
              defaultValue={brand}
              placeholder="COSRX"
              className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            제품명 검색
            <input
              name="search"
              defaultValue={search}
              placeholder="에센스"
              className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            제품 ID
            <input
              name="id"
              defaultValue={productId}
              placeholder="4"
              className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            큐 우선순위
            <select
              name="priority"
              defaultValue={priority}
              className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
            >
              <option value="">전체</option>
              <option value="1">P1</option>
              <option value="2">P2</option>
              <option value="3">P3</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded bg-[#8B6914] px-3 py-2 text-sm font-medium text-white"
            >
              필터
            </button>
            <a
              href={exportHref}
              className="rounded border border-[#E8DFD8] px-3 py-2 text-sm"
            >
              CSV
            </a>
          </div>
        </form>

        <p className="mb-2 text-xs text-gray-500">
          표시 {filtered.length} / 전체 {summary.totalProducts} · 생성{" "}
          {summary.generatedAt}
        </p>

        <div className="overflow-x-auto rounded-xl border border-[#E8DFD8] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">브랜드</th>
                <th className="px-3 py-2">제품명</th>
                <th className="px-3 py-2">용량</th>
                <th className="px-3 py-2">신뢰 상태</th>
                <th className="px-3 py-2">verified_at</th>
                <th className="px-3 py-2">KR offer</th>
                <th className="px-3 py-2">가격</th>
                <th className="px-3 py-2">재고</th>
                <th className="px-3 py-2">retailer</th>
                <th className="px-3 py-2">검토 사유</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((p) => (
                <tr key={p.id} className="border-b border-[#F0E8E2] align-top">
                  <td className="px-3 py-2">
                    <Link
                      href={buildHref(baseParams, { detail: p.id })}
                      className="font-medium text-[#8B6914] underline"
                    >
                      {p.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{p.brand}</td>
                  <td className="px-3 py-2">{p.displayNameKo}</td>
                  <td className="px-3 py-2">{p.sizeLabel ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.status}</div>
                    <div className="text-xs text-gray-500">
                      {catalogTrustStatusLabelKo(p.status)}
                    </div>
                  </td>
                  <td className="px-3 py-2">{formatDate(p.verifiedAt)}</td>
                  <td className="px-3 py-2">
                    {p.hasKrStrictOffer ? "strict" : p.offerCount > 0 ? "있음" : "없음"}
                  </td>
                  <td className="px-3 py-2">{formatPrice(p.krPrice)}</td>
                  <td className="px-3 py-2">{p.krStock ?? "—"}</td>
                  <td className="px-3 py-2">{p.krRetailer ?? "—"}</td>
                  <td className="max-w-xs px-3 py-2 text-xs text-gray-600">
                    {p.reviewReasons.join("; ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 ? (
          <p className="mt-2 text-xs text-gray-500">
            화면에는 상위 200행만 표시합니다. CSV로 전체 필터 결과를 받으세요.
          </p>
        ) : null}

        {detail ? (
          <section className="mt-8 rounded-xl border border-[#E8DFD8] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">
                상세 · #{detail.id} {detail.displayNameKo}
              </h2>
              <Link
                href={buildHref(baseParams)}
                className="text-sm text-gray-600 underline"
              >
                닫기
              </Link>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">표시 이름 (KO/EN)</dt>
                <dd>
                  {detail.displayNameKo} / {detail.displayNameEn}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">용량 · 카테고리</dt>
                <dd>
                  {detail.sizeLabel ?? "—"} · {detail.category ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">신뢰 상태</dt>
                <dd>
                  {detail.status} · P{detail.queuePriority}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">중복</dt>
                <dd>
                  {detail.duplicateGroupKey
                    ? `${detail.duplicateGroupKey} → ${detail.duplicatePeerIds.join(", ") || "—"}`
                    : "없음"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">검토 사유</dt>
                <dd>{detail.reviewReasons.join("; ") || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">
                  Strict eligibility 실패 이유 (KR)
                </dt>
                <dd className="whitespace-pre-wrap text-xs text-gray-700">
                  {detail.eligibilityFailures.length
                    ? detail.eligibilityFailures.join("\n")
                    : detail.hasKrStrictOffer
                      ? "KR strict 통과"
                      : "offer 없음"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-gray-500">
              원본 제품 편집은{" "}
              <Link
                href={`/admin/products/${detail.id}`}
                className="underline"
              >
                /admin/products/{detail.id}
              </Link>
              에서 기존 워크플로를 사용하세요. 이 화면은 읽기 전용입니다.
            </p>
          </section>
        ) : null}

        <section className="mt-8 rounded-xl border border-[#E8DFD8] bg-white p-5">
          <h2 className="text-lg font-semibold">판매처 검수 큐 (상위 20)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            {report.offerGaps.slice(0, 20).map((g) => (
              <li key={g.productId}>
                <span className="font-medium">
                  P{g.priority} · #{g.productId} {g.brand} {g.displayNameKo}
                </span>
                <span className="text-gray-600">
                  {" "}
                  — {g.status}: {g.reasons.join("; ")}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
