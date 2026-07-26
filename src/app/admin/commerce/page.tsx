import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminSubnav } from "@/app/admin/AdminSubnav";
import { summarizeCommerceAnalytics } from "@/lib/commercial/commerceAnalytics";
import {
  buildAffiliateAdminSummary,
  listAffiliateLinks,
} from "@/lib/commercial/commerceStore";
import { resolveAdSlot } from "@/lib/commercial/adSlotPolicy";
import { COMMERCE_LANE_LABELS_KO } from "@/lib/commercial/commerceLabels";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "상업 분리 검수 | K-Beauty Match Admin",
};

export default async function AdminCommercePage() {
  await requireAdminUser();
  const summary = buildAffiliateAdminSummary();
  const links = listAffiliateLinks().slice(0, 30);
  const analytics = summarizeCommerceAnalytics();
  const organicSlot = resolveAdSlot("organic_recommendation");
  const sponsoredSlot = resolveAdSlot("sponsored_rail");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 text-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Admin · Stage 7
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Organic / 제휴 / 스폰서 검수
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        유료 관계가 Organic 점수를 바꾸지 않는지, 광고 슬롯이 분리되는지, 건강정보
        타기팅이 금지되는지 확인합니다. Production 쓰기는 없습니다.
      </p>
      <AdminSubnav current="commerce" />

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">제휴 링크 요약</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">전체</dt>
            <dd className="font-medium">{summary.total}</dd>
          </div>
          <div>
            <dt className="text-gray-500">publishable</dt>
            <dd className="font-medium">{summary.publishable}</dd>
          </div>
          <div>
            <dt className="text-gray-500">blocked</dt>
            <dd className="font-medium">{summary.blocked}</dd>
          </div>
          <div>
            <dt className="text-gray-500">affiliate</dt>
            <dd className="font-medium">{summary.affiliate}</dd>
          </div>
          <div>
            <dt className="text-gray-500">sponsored</dt>
            <dd className="font-medium">{summary.sponsored}</dd>
          </div>
          <div>
            <dt className="text-gray-500">databaseTouched</dt>
            <dd className="font-medium">{String(summary.databaseTouched)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">광고 슬롯 정책</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            {COMMERCE_LANE_LABELS_KO.organic}: sponsored=
            {String(organicSlot.allowSponsored)} · affiliate=
            {String(organicSlot.allowAffiliate)}
          </li>
          <li>
            {COMMERCE_LANE_LABELS_KO.sponsored}: organic=
            {String(sponsoredSlot.allowOrganic)} · sponsored=
            {String(sponsoredSlot.allowSponsored)}
          </li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">이벤트 집계 (in-memory)</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">click</dt>
            <dd className="font-medium">{analytics.clicks}</dd>
          </div>
          <div>
            <dt className="text-gray-500">lead</dt>
            <dd className="font-medium">{analytics.leads}</dd>
          </div>
          <div>
            <dt className="text-gray-500">conversion</dt>
            <dd className="font-medium">{analytics.conversions}</dd>
          </div>
          <div>
            <dt className="text-gray-500">revenue</dt>
            <dd className="font-medium">{analytics.revenueEvents}</dd>
          </div>
          <div>
            <dt className="text-gray-500">healthTargetingClaims</dt>
            <dd className="font-medium">{analytics.healthTargetingClaims}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">제휴 링크 목록</h2>
        {links.length === 0 ? (
          <p className="text-sm text-gray-600">
            아직 메모리에 등록된 제휴 링크가 없습니다. 코드/selftest fixture만
            존재하며 가짜 URL을 게시하지 않습니다.
          </p>
        ) : (
          links.map((link) => (
            <article
              key={link.id}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
            >
              <p className="font-medium">
                {link.entityType}/{link.entityId} · {link.reviewStatus}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                affiliate={String(link.isAffiliate)} · sponsored=
                {String(link.isSponsored)} · organicRank=
                {link.organicRank ?? "null"}
              </p>
              {link.disclosureLabel ? (
                <p className="mt-1 text-xs text-amber-900">{link.disclosureLabel}</p>
              ) : null}
            </article>
          ))
        )}
      </section>

      <p className="mt-8 text-sm text-gray-600">
        병원 Organic/제휴 분리는{" "}
        <Link href="/admin/clinics" className="underline">
          병원 검수
        </Link>
        에서 확인합니다.
      </p>
    </main>
  );
}
