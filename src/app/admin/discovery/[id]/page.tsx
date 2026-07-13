import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getAdminDiscoveryDetail,
  parseAdminDiscoveryId,
  type AdminDiscoveryDetailPayload,
} from "@/lib/admin/discovery-detail";
import { AdminLogoutButton } from "../../AdminLogoutButton";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Discovery Detail | K-Beauty Match",
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
  return (
    <span className="font-medium">{value ? "true" : "false"}</span>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function workflowBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "verified":
      return "bg-violet-50 text-violet-800 border-violet-200";
    case "needs_review":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "rejected":
      return "bg-red-50 text-red-800 border-red-200";
    case "discovered":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-sky-50 text-sky-800 border-sky-200";
  }
}

function DetailBody({ data }: { data: AdminDiscoveryDetailPayload }) {
  const { candidate, linkedProduct, queue, statusSummary } = data;

  return (
    <>
      <Section title="기본 정보">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">후보명</dt>
            <dd className="font-medium">{candidate.candidateName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">브랜드</dt>
            <dd>{candidate.brandName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">국가</dt>
            <dd>{candidate.country ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">source type</dt>
            <dd>{candidate.sourceType ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">search_query</dt>
            <dd>{candidate.searchQuery ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">discovered_at</dt>
            <dd className="tabular-nums">
              {formatDate(candidate.discoveredAt)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">created_at</dt>
            <dd className="tabular-nums">{formatDate(candidate.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">updated_at</dt>
            <dd className="tabular-nums">{formatDate(candidate.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">담당</dt>
            <dd>
              <BoolLabel value={candidate.isAssigned} />
            </dd>
          </div>
        </dl>
        {candidate.notes ? (
          <p className="mt-4 text-sm text-gray-700">
            <span className="text-gray-500">notes: </span>
            {candidate.notes}
          </p>
        ) : null}
      </Section>

      <Section title="출처">
        {candidate.sourceUrlSafeHttps && candidate.sourceUrl ? (
          <a
            href={candidate.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#8B6914] underline"
          >
            출처 열기
          </a>
        ) : (
          <p className="text-sm text-gray-500">
            {candidate.sourceUrl
              ? "출처 URL이 https가 아니거나 안전하지 않아 클릭할 수 없습니다."
              : "출처 URL 없음"}
          </p>
        )}
      </Section>

      <Section
        title="workflow 상태"
        description="canProceedToNextStage는 읽기 전용 참고값입니다. 상태 변경 버튼은 없습니다."
      >
        <p className="mb-4">
          <span
            className={`inline-block rounded border px-2 py-1 text-sm font-medium ${workflowBadgeClass(candidate.workflowStatus)}`}
          >
            {candidate.workflowStatus}
          </span>
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">saleChecked</dt>
            <dd>
              <BoolLabel value={statusSummary.saleChecked} />
              <span className="ml-2 text-xs text-gray-500">
                ({candidate.saleCheckStatus})
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">ingredientsChecked</dt>
            <dd>
              <BoolLabel value={statusSummary.ingredientsChecked} />
              <span className="ml-2 text-xs text-gray-500">
                ({candidate.ingredientCheckStatus})
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">evidenceChecked</dt>
            <dd>
              <BoolLabel value={statusSummary.evidenceChecked} />
              <span className="ml-2 text-xs text-gray-500">
                ({candidate.evidenceCheckStatus})
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">safetyChecked</dt>
            <dd>
              <BoolLabel value={statusSummary.safetyChecked} />
              <span className="ml-2 text-xs text-gray-500">
                ({candidate.safetyCheckStatus})
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">verified</dt>
            <dd>
              <BoolLabel value={statusSummary.verified} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">published</dt>
            <dd>
              <BoolLabel value={statusSummary.published} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">canProceedToNextStage</dt>
            <dd>
              <BoolLabel value={statusSummary.canProceedToNextStage} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">nextStage</dt>
            <dd>{statusSummary.nextStage ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-gray-600">{statusSummary.nextStageHint}</p>
      </Section>

      <Section title="중복 검사">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">duplicate_check_status</dt>
            <dd className="font-medium">{candidate.duplicateStatus}</dd>
          </div>
          <div>
            <dt className="text-gray-500">duplicatePassed</dt>
            <dd>
              <BoolLabel value={statusSummary.duplicatePassed} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">linked_product_id</dt>
            <dd className="tabular-nums">
              {candidate.linkedProductId ?? "미연결"}
            </dd>
          </div>
        </dl>
        {linkedProduct ? (
          <p className="mt-4 text-sm">
            연결 제품:{" "}
            <Link
              href={`/admin/products/${linkedProduct.id}`}
              className="font-medium text-[#8B6914] underline"
            >
              {linkedProduct.name}
            </Link>
            <span className="text-gray-500">
              {" "}
              · {linkedProduct.brand}
              {linkedProduct.category ? ` · ${linkedProduct.category}` : ""}
            </span>
          </p>
        ) : (
          <p className="mt-4 text-sm text-gray-500">연결된 제품 없음</p>
        )}
      </Section>

      <Section title="검증 큐">
        {queue.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 검증 큐 항목이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">review</th>
                  <th className="px-3 py-2">status</th>
                  <th className="px-3 py-2">priority</th>
                  <th className="px-3 py-2">담당</th>
                  <th className="px-3 py-2">reason</th>
                  <th className="px-3 py-2">created</th>
                  <th className="px-3 py-2">reviewed</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#F0E8E2] last:border-0"
                  >
                    <td className="px-3 py-2">{item.reviewType}</td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2 tabular-nums">{item.priority}</td>
                    <td className="px-3 py-2">
                      <BoolLabel value={item.isAssigned} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {item.reason ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatDate(item.reviewedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {statusSummary.hasOpenQueue ? (
          <p className="mt-3 text-sm text-amber-800">열린 검토 큐가 있습니다.</p>
        ) : null}
      </Section>

      <Section title="운영 경고">
        <ul className="list-disc space-y-2 pl-5 text-sm text-amber-900">
          <li>검색 결과만으로 verified/published가 아닙니다.</li>
          <li>판매 확인, 공식 전성분, 근거, 안전성 검토가 필요합니다.</li>
          <li>이 화면은 읽기 전용입니다. 승인·reject·publish·상태 변경 버튼이 없습니다.</li>
        </ul>
      </Section>
    </>
  );
}

/**
 * Read-only discovery candidate detail page.
 */
export default async function AdminDiscoveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();

  const { id: rawId } = await params;
  const candidateId = parseAdminDiscoveryId(rawId);
  if (!candidateId) {
    notFound();
  }

  let data: AdminDiscoveryDetailPayload | null = null;
  let loadFailed = false;

  try {
    data = await getAdminDiscoveryDetail(candidateId);
  } catch (error) {
    loadFailed = true;
    if (!(error instanceof AdminConfigurationError)) {
      loadFailed = true;
    }
  }

  if (!loadFailed && !data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {data?.candidate.candidateName ?? "제품 발견 후보"}
              </h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                읽기 전용
              </span>
            </div>
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/admin/discovery"
            className="font-medium text-[#8B6914] underline"
          >
            목록으로 돌아가기
          </Link>
          <Link href="/admin" className="font-medium text-[#8B6914] underline">
            대시보드로 돌아가기
          </Link>
        </p>

        {loadFailed || !data ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            후보 상세를 불러오지 못했습니다.{" "}
            <Link href="/admin/discovery" className="font-medium underline">
              목록으로 이동
            </Link>
          </div>
        ) : (
          <DetailBody data={data} />
        )}
      </div>
    </main>
  );
}
