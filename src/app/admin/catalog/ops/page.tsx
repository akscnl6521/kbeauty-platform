import { requireAdminUser } from "@/lib/auth/admin";
import { AdminSubnav } from "@/app/admin/AdminSubnav";
import {
  buildAdminOpsSummary,
  getStaleRefreshQueue,
  listAdminOpsAuditTrail,
  listAdminOpsCandidates,
  seedAdminOpsFixtures,
} from "@/lib/catalog/adminOps";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "카탈로그 운영 검수 | K-Beauty Match Admin",
};

export default async function AdminCatalogOpsPage() {
  await requireAdminUser();
  if (listAdminOpsCandidates().length === 0) {
    seedAdminOpsFixtures();
  }
  const summary = buildAdminOpsSummary();
  const candidates = listAdminOpsCandidates().slice(0, 40);
  const stale = getStaleRefreshQueue().slice(0, 20);
  const audit = listAdminOpsAuditTrail(20);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 text-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Admin · Stage 4/8
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        사용 가이드·후보 운영 검수
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        후보 검수·중복 병합·근거 검토·상태 전환·만료 갱신 큐·재시도·감사 기록을
        로컬/Staging dry-run으로 확인합니다. Production·원격 DB 쓰기는 없습니다.
      </p>
      <AdminSubnav current="catalog-ops" />

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">요약</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">후보</dt>
            <dd className="font-medium">{summary.total}</dd>
          </div>
          <div>
            <dt className="text-gray-500">만료 갱신 큐</dt>
            <dd className="font-medium">{summary.staleQueue}</dd>
          </div>
          <div>
            <dt className="text-gray-500">감사 이벤트</dt>
            <dd className="font-medium">{summary.auditEvents}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-gray-500">
          stagingWriteAllowed={String(summary.stagingWriteAllowed)} ·
          productionTouched={String(summary.productionTouched)}
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">상태별 건수</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {Object.entries(summary.byStatus).map(([status, count]) => (
            <li key={status} className="flex justify-between gap-4">
              <span>{status}</span>
              <span className="font-medium">{count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">만료·재시도 큐</h2>
        {stale.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">대기 항목 없음</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {stale.map((item) => (
              <li
                key={item.candidateId}
                className="rounded-lg border border-gray-100 px-3 py-2"
              >
                <p className="font-medium">
                  [{item.priority}] {item.title}
                </p>
                <p className="text-xs text-gray-500">
                  {item.candidateId} · due {item.refreshDueAt} · retry{" "}
                  {item.retryCount}
                  {item.lastError ? ` · ${item.lastError}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">후보 목록</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-gray-100 px-3 py-2"
            >
              <p className="font-medium">
                {c.title}{" "}
                <span className="text-xs font-normal text-gray-500">
                  ({c.kind} · {c.reviewStatus})
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {c.id}
                {c.locale ? ` · ${c.locale}` : ""}
                {c.countryCode ? ` · ${c.countryCode}` : ""}
                {c.duplicateGroupId ? ` · dup ${c.duplicateGroupId}` : ""}
                {c.mergedIntoId ? ` · merged→${c.mergedIntoId}` : ""}
                · evidence {c.evidence.filter((e) => e.verified).length}/
                {c.evidence.length}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">감사 기록</h2>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">기록 없음</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {audit.map((event) => (
              <li key={event.id} className="rounded-lg border border-gray-100 px-3 py-2">
                <p className="font-medium">
                  {event.action} · {event.candidateId}
                </p>
                <p className="text-xs text-gray-500">
                  {event.at} · {event.fromStatus ?? "—"} → {event.toStatus ?? "—"} ·
                  db={String(event.databaseTouched)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-gray-500">
        API dry-run: <code>/api/admin/catalog-ops</code> (GET/POST)
      </p>
    </main>
  );
}
