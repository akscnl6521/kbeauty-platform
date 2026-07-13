import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  getAdminDashboardData,
  type AdminDashboardData,
} from "@/lib/admin/dashboard";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { AdminSubnav } from "./AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Dashboard | K-Beauty Match",
  robots: { index: false, follow: false },
};

type StatItem = { label: string; value: number };

const QUICK_LINKS: Array<{
  href?: string;
  label: string;
  ready: boolean;
  note?: string;
}> = [
  {
    href: "/admin/catalog-review",
    label: "카탈로그 검증 대기",
    ready: true,
    note: "dev",
  },
  {
    href: "/admin/products",
    label: "Products",
    ready: true,
    note: "기존 제품·검증 상태 확인",
  },
  {
    href: "/admin/discovery/import",
    label: "URL로 빠른 등록",
    ready: true,
    note: "제품 URL 붙여넣기 자동 후보 등록",
  },
  {
    href: "/admin/discovery",
    label: "Discovery",
    ready: true,
    note: "판매 제품 발견 후보와 검증 상태 확인",
  },
  {
    href: "/admin/ingredients",
    label: "Ingredients",
    ready: true,
    note: "성분, 근거, 주의사항, 제품 연결 상태 확인",
  },
  {
    href: "/admin/verification",
    label: "Verification",
    ready: true,
    note: "검증 큐 읽기 전용",
  },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-[#E8DFD8] pt-6">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatGrid({ items }: { items: StatItem[] }) {
  const allZero = items.every((item) => item.value === 0);

  return (
    <div>
      {allZero ? (
        <p className="mb-3 text-sm text-gray-500">
          아직 데이터가 없습니다. 검색만으로 published 하지 마세요.
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
          >
            <dt className="text-xs text-gray-500">{item.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
              {item.value.toLocaleString("ko-KR")}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DashboardBody({ data }: { data: AdminDashboardData }) {
  const catalogItems: StatItem[] = [
    { label: "products", value: data.catalog.products },
    { label: "ingredients", value: data.catalog.ingredients },
    { label: "offers", value: data.catalog.offers },
    { label: "brands", value: data.catalog.brands },
    { label: "variants", value: data.catalog.variants },
  ];

  const verificationItems: StatItem[] = [
    { label: "discovered", value: data.verification.discovered },
    { label: "sale_checked", value: data.verification.sale_checked },
    {
      label: "ingredients_checked",
      value: data.verification.ingredients_checked,
    },
    { label: "evidence_checked", value: data.verification.evidence_checked },
    { label: "safety_checked", value: data.verification.safety_checked },
    { label: "verified", value: data.verification.verified },
    { label: "published", value: data.verification.published },
    { label: "needs_review", value: data.verification.needs_review },
    { label: "rejected", value: data.verification.rejected },
  ];

  const queueItems: StatItem[] = [
    { label: "pending", value: data.queue.pending },
    { label: "in_review", value: data.queue.in_review },
    { label: "approved", value: data.queue.approved },
    { label: "rejected", value: data.queue.rejected },
    { label: "needs_review", value: data.queue.needs_review },
  ];

  const qualityItems: StatItem[] = [
    { label: "ingredient evidence", value: data.quality.ingredientEvidence },
    { label: "ingredient cautions", value: data.quality.ingredientCautions },
    {
      label: "approved product ingredients",
      value: data.quality.verifiedProductIngredients,
    },
    { label: "verified offers", value: data.quality.verifiedOffers },
  ];

  const systemItems: StatItem[] = [
    { label: "admin accounts", value: data.system.adminCount },
    { label: "active admins", value: data.system.activeAdminCount },
  ];

  const pipelineReady = data.catalog.products > 0 || data.catalog.ingredients > 0;
  const pipelineEmpty =
    verificationItems.every((i) => i.value === 0) &&
    queueItems.every((i) => i.value === 0);

  return (
    <>
      <Section
        title="운영 현황"
        description="공개·파이프라인 카탈로그 규모 (읽기 전용)"
      >
        <StatGrid items={catalogItems} />
        {pipelineReady && data.catalog.offers === 0 ? (
          <p className="mt-3 text-sm text-amber-800">
            기존 products는 자동 published 대상이 아닙니다. offer·검증 파이프라인을
            거친 뒤에만 추천에 사용하세요.
          </p>
        ) : null}
      </Section>

      <Section
        title="검증 파이프라인"
        description="product_discovery_candidates.workflow_status"
      >
        {pipelineEmpty ? (
          <p className="mb-3 text-sm text-gray-500">
            Search-to-Verified 후보가 아직 없습니다. (준비 중 / 0건)
          </p>
        ) : null}
        <StatGrid items={verificationItems} />
      </Section>

      <Section title="검토 큐" description="verification_queue.status">
        <StatGrid items={queueItems} />
      </Section>

      <Section title="데이터 품질" description="근거·주의·검증된 연결 수">
        <StatGrid items={qualityItems} />
      </Section>

      <Section title="시스템" description="관리자 계정 총계 (개인정보 없음)">
        <StatGrid items={systemItems} />
      </Section>
    </>
  );
}

/**
 * Read-only admin operations dashboard.
 */
export default async function AdminHomePage() {
  const session = await requireAdminUser();

  let data: AdminDashboardData | null = null;
  let loadFailed = false;

  try {
    data = await getAdminDashboardData();
  } catch (error) {
    if (error instanceof AdminConfigurationError) {
      loadFailed = true;
    } else {
      loadFailed = true;
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              관리자 대시보드
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              역할: <span className="font-medium text-gray-900">{session.role}</span>
              {session.active ? " · active" : null}
            </p>
            <AdminSubnav current="dashboard" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          읽기 전용 운영 현황입니다. 이 화면에서는 생성·수정·publish를 하지
          않습니다.
        </p>

        {loadFailed || !data ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        ) : (
          <DashboardBody data={data} />
        )}

        <Section title="빠른 이동">
          <ul className="space-y-2 text-sm">
            {QUICK_LINKS.map((item) => (
              <li key={item.label}>
                {item.ready && item.href ? (
                  <Link
                    href={item.href}
                    className="font-medium text-[#8B6914] underline"
                  >
                    {item.label}
                    {item.note ? (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        ({item.note})
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <span className="text-gray-400">
                    {item.label}
                    <span className="ml-2 text-xs">준비 중</span>
                  </span>
                )}
              </li>
            ))}
            <li className="pt-2 text-gray-500">
              API:{" "}
              <code className="text-gray-800">GET /api/admin/dashboard</code>
              {" · "}
              <code className="text-gray-800">GET /api/admin/auth-check</code>
            </li>
          </ul>
        </Section>
      </div>
    </main>
  );
}
