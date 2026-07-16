import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminWriteCapabilityFlags } from "@/lib/auth/admin-permissions";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getAdminVerificationDetail,
  parseAdminVerificationId,
  type AdminVerificationDetailPayload,
} from "@/lib/admin/verification-detail";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";
import { VerificationReviewPanel } from "../VerificationReviewPanel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Verification Detail | K-Beauty Match",
  robots: { index: false, follow: false },
};

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

function BoolLabel({ value }: { value: boolean }) {
  return <span className="font-medium">{value ? "true" : "false"}</span>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function SafeUrl({
  url,
  safe,
  label,
}: {
  url: string | null;
  safe: boolean;
  label: string;
}) {
  if (!url) return <span className="text-gray-400">—</span>;
  if (!safe) return <span className="text-xs text-gray-400">링크 비활성</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-[#8B6914] underline"
    >
      {label}
    </a>
  );
}

function LinkedEntitySection({
  data,
}: {
  data: AdminVerificationDetailPayload;
}) {
  const { linked } = data;

  if (!linked.found) {
    return (
      <Section title="연결 엔티티">
        <p className="text-sm text-gray-500">
          entity_type=<span className="font-medium">{linked.kind}</span>에 대한
          연결 행을 찾지 못했습니다. (삭제되었거나 id 형식 불일치)
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="연결 엔티티"
      description={`entity_type=${linked.kind}`}
    >
      {linked.detailHref ? (
        <p className="mb-4 text-sm">
          <Link
            href={linked.detailHref}
            className="font-medium text-[#8B6914] underline"
          >
            관련 관리 화면 열기
          </Link>
        </p>
      ) : null}

      {linked.candidate ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">후보명</dt>
            <dd className="font-medium">{linked.candidate.candidateName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">브랜드</dt>
            <dd>{linked.candidate.brandName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">workflow</dt>
            <dd>{linked.candidate.workflowStatus}</dd>
          </div>
          <div>
            <dt className="text-gray-500">source</dt>
            <dd>
              <SafeUrl
                url={linked.candidate.sourceUrl}
                safe={linked.candidate.sourceUrlSafeHttps}
                label="출처 열기"
              />
            </dd>
          </div>
        </dl>
      ) : null}

      {linked.product ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">제품</dt>
            <dd className="font-medium">{linked.product.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">브랜드</dt>
            <dd>{linked.product.brand}</dd>
          </div>
          <div>
            <dt className="text-gray-500">category</dt>
            <dd>{linked.product.category ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">active</dt>
            <dd>
              {linked.product.active == null ? (
                <span className="text-gray-400">—</span>
              ) : (
                <BoolLabel value={linked.product.active} />
              )}
            </dd>
          </div>
        </dl>
      ) : null}

      {linked.ingredient ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">영문명</dt>
            <dd className="font-medium">{linked.ingredient.nameEn}</dd>
          </div>
          <div>
            <dt className="text-gray-500">한글명</dt>
            <dd>{linked.ingredient.nameKo ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">slug</dt>
            <dd>{linked.ingredient.slug}</dd>
          </div>
        </dl>
      ) : null}

      {linked.offer ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">retailer</dt>
            <dd className="font-medium">{linked.offer.retailerName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">verification</dt>
            <dd>{linked.offer.verificationStatus}</dd>
          </div>
          <div>
            <dt className="text-gray-500">purchase</dt>
            <dd>
              <SafeUrl
                url={linked.offer.purchaseUrl}
                safe={linked.offer.purchaseUrlSafeHttps}
                label="판매처"
              />
            </dd>
          </div>
        </dl>
      ) : null}

      {linked.variant ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">variant</dt>
            <dd className="font-medium">
              {linked.variant.variantName ?? linked.variant.id}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">country</dt>
            <dd>{linked.variant.countryCode}</dd>
          </div>
          <div>
            <dt className="text-gray-500">verification</dt>
            <dd>{linked.variant.verificationStatus}</dd>
          </div>
        </dl>
      ) : null}

      {linked.brand ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">canonical</dt>
            <dd className="font-medium">{linked.brand.canonicalName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">name_en / ko</dt>
            <dd>
              {linked.brand.nameEn ?? "—"} / {linked.brand.nameKo ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">verification</dt>
            <dd>{linked.brand.verificationStatus}</dd>
          </div>
        </dl>
      ) : null}

      {linked.evidence ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">type / level</dt>
            <dd>
              {linked.evidence.evidenceType} · {linked.evidence.evidenceLevel}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">review</dt>
            <dd>{linked.evidence.reviewStatus}</dd>
          </div>
          <div>
            <dt className="text-gray-500">source</dt>
            <dd>
              <SafeUrl
                url={linked.evidence.sourceUrl}
                safe={linked.evidence.sourceUrlSafeHttps}
                label="출처"
              />
            </dd>
          </div>
        </dl>
      ) : null}
    </Section>
  );
}

function DetailBody({ data }: { data: AdminVerificationDetailPayload }) {
  const { queue } = data;

  return (
    <>
      <Section title="큐 정보">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">entity_type</dt>
            <dd className="font-medium">{queue.entityType}</dd>
          </div>
          <div>
            <dt className="text-gray-500">entity_id</dt>
            <dd className="break-all">{queue.entityId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">review_type</dt>
            <dd>{queue.reviewType}</dd>
          </div>
          <div>
            <dt className="text-gray-500">status</dt>
            <dd className="font-medium">{queue.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">priority</dt>
            <dd className="tabular-nums">{queue.priority}</dd>
          </div>
          <div>
            <dt className="text-gray-500">assigned</dt>
            <dd>
              <BoolLabel value={queue.isAssigned} />
              <span className="ml-2 text-xs text-gray-400">
                (담당자 원문 비노출)
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">created_at</dt>
            <dd className="tabular-nums">{formatDate(queue.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">reviewed_at</dt>
            <dd className="tabular-nums">{formatDate(queue.reviewedAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">reason</dt>
            <dd className="mt-1 whitespace-pre-wrap">{queue.reason ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">reviewer_notes</dt>
            <dd className="mt-1 whitespace-pre-wrap">
              {queue.reviewerNotes ?? "—"}
            </dd>
          </div>
        </dl>
      </Section>

      <LinkedEntitySection data={data} />
    </>
  );
}

/**
 * Verification detail with controlled review actions.
 */
export default async function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminUser();
  const caps = getAdminWriteCapabilityFlags(session.role);

  const { id: rawId } = await params;
  const queueId = parseAdminVerificationId(rawId);
  if (!queueId) notFound();

  let data: AdminVerificationDetailPayload | null = null;
  let loadFailed = false;

  try {
    data = await getAdminVerificationDetail(queueId);
  } catch (error) {
    loadFailed = true;
    if (!(error instanceof AdminConfigurationError)) {
      loadFailed = true;
    }
  }

  if (!loadFailed && !data) notFound();

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">검증 큐 상세</h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                읽기 + 검토 쓰기
              </span>
            </div>
            {data ? (
              <p className="mt-2 text-sm text-gray-600">
                {data.queue.entityType} · {data.queue.reviewType} ·{" "}
                {data.queue.status}
              </p>
            ) : null}
            <AdminSubnav current="verification" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-4 text-sm">
          <Link
            href="/admin/verification"
            className="font-medium text-[#8B6914] underline"
          >
            목록으로 돌아가기
          </Link>
        </p>

        {loadFailed || !data ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            검증 상세를 불러오지 못했습니다.{" "}
            <Link href="/admin/verification" className="font-medium underline">
              목록으로 이동
            </Link>
          </div>
        ) : (
          <>
            <DetailBody data={data} />
            <VerificationReviewPanel
              queueId={data.queue.id}
              status={data.queue.status}
              reviewType={data.queue.reviewType}
              canReview={caps.canReviewQueue}
              canPublish={caps.canPublish}
            />
          </>
        )}
      </div>
    </main>
  );
}
