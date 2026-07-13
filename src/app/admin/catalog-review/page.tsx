import { notFound } from "next/navigation";
import {
  buildCatalogReviewRows,
  validateKrCatalog,
} from "@/lib/catalog/loadKrCatalog";
import { displayBrandName } from "@/lib/brand/displayBrandName";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catalog Review (Dev) | K-Beauty Match",
  robots: { index: false, follow: false },
};

function formatPrice(price: number | null | undefined, currency: string | null) {
  if (price == null || !Number.isFinite(price)) return "—";
  const cur = currency ?? "";
  if (cur === "KRW") {
    return `${price.toLocaleString("ko-KR")}원`;
  }
  return `${price.toLocaleString("en-US")} ${cur}`.trim();
}

/**
 * 개발 전용 — 한국 카탈로그 검증 대기 목록.
 * 로그인/권한 없음. production 에서는 404.
 */
export default function CatalogReviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const rows = buildCatalogReviewRows();
  const report = validateKrCatalog();
  const awaitingCount = rows.filter((r) => r.awaitingStockVerification).length;
  const coreEligibleCount = rows.filter((r) => r.coreRecommendEligible).length;

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-[#E8DFD8] pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
            Dev only · Sprint 14
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display,Playfair_Display,serif)] text-3xl font-bold tracking-tight text-gray-900">
            카탈로그 검증 대기
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
            공식 제품명·가격은 확인됐으나 실시간 재고·구매 가능 여부가 최종
            확인되지 않은 offer입니다. 이 상태에서는 핵심 추천 Top 5에 포함되지
            않습니다.
          </p>
        </header>

        <section className="mb-8 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#E8DFD8] bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              행 수
            </p>
            <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-[#E8DFD8] bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              검증 대기
            </p>
            <p className="mt-1 text-2xl font-semibold">{awaitingCount}</p>
          </div>
          <div className="rounded-2xl border border-[#E8DFD8] bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              핵심 추천 가능
            </p>
            <p className="mt-1 text-2xl font-semibold">{coreEligibleCount}</p>
          </div>
          <div className="rounded-2xl border border-[#E8DFD8] bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              validateCatalogData
            </p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                report.ok ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {report.ok ? "OK" : `${report.errorCount} errors`}
            </p>
          </div>
        </section>

        {!report.ok ? (
          <section className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-semibold">검증 오류</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {report.issues
                .filter((i) => i.severity === "error")
                .map((i, idx) => (
                  <li key={`${i.code}-${idx}`}>{i.message}</li>
                ))}
            </ul>
          </section>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-[#E8DFD8] bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wider text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">브랜드</th>
                <th className="px-4 py-3 font-semibold">제품명</th>
                <th className="px-4 py-3 font-semibold">판매처</th>
                <th className="px-4 py-3 font-semibold">가격</th>
                <th className="px-4 py-3 font-semibold">재고</th>
                <th className="px-4 py-3 font-semibold">검증</th>
                <th className="px-4 py-3 font-semibold">마지막 확인</th>
                <th className="px-4 py-3 font-semibold">핵심 추천</th>
                <th className="px-4 py-3 font-semibold">링크</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const brand =
                  displayBrandName(row.product.canonicalBrandName, "ko") ??
                  row.product.canonicalBrandName;
                const offer = row.offer;
                return (
                  <tr
                    key={`${row.product.productId}-${offer?.offerId ?? "none"}`}
                    className="border-b border-[#F0E8E1] align-top last:border-0"
                  >
                    <td className="px-4 py-4 font-medium text-gray-900">
                      {brand}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">
                        {row.product.productNameKo}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {row.product.productNameEn}
                      </p>
                      <p className="mt-2 text-xs leading-snug text-amber-800">
                        {row.statusMessageKo}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      {offer?.retailerName ?? "—"}
                      <p className="text-xs text-gray-500">
                        {offer?.retailerCountry ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-4 tabular-nums text-gray-900">
                      {formatPrice(offer?.price, offer?.currency ?? null)}
                      <p className="text-xs text-gray-500">
                        {offer?.currency ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {offer?.stockStatus ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                        {offer?.verificationStatus ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-600">
                      {offer?.lastCheckedAt ?? "—"}
                      <p className="mt-1 text-gray-400">
                        verifiedAt: {offer?.verifiedAt ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {row.coreRecommendEligible ? (
                        <span className="text-xs font-semibold text-emerald-700">
                          가능
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-red-700">
                          불가
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {offer?.purchaseUrl ? (
                        <a
                          href={offer.purchaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-[#8B4513] underline-offset-2 hover:underline"
                        >
                          공식 페이지 열기
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          데이터:{" "}
          <code className="rounded bg-white px-1 py-0.5">
            data/catalog/kr/cosrx-*.json
          </code>
          · production 빌드에서는 이 경로가 404입니다.
        </p>
      </div>
    </main>
  );
}
