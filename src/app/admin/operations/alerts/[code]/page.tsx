import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations/health";
import { getAlertDetail } from "@/lib/admin/operations/alerts";
import { listAlertRules } from "@/lib/admin/operations/rules";
import type { OperationsAlertCode } from "@/lib/admin/operations/types";
import { AdminLogoutButton } from "../../../AdminLogoutButton";
import { AdminSubnav } from "../../../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Alert Detail | K-Beauty Match",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function AdminOperationsAlertDetailPage({
  params,
}: PageProps) {
  await requireAdminUser();
  const { code } = await params;
  const known = listAlertRules().some((r) => r.code === code);
  if (!known) notFound();

  let snapshot;
  try {
    snapshot = await getOperationsHealthSnapshot({ persistAlerts: false });
  } catch (e) {
    if (e instanceof AdminConfigurationError) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-red-800">{e.message}</p>
        </main>
      );
    }
    throw e;
  }

  const detail = getAlertDetail(code as OperationsAlertCode, snapshot.alerts);
  const a = detail.alert;
  const g = detail.guidance;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{code}</h1>
          <AdminSubnav current="operations" />
        </div>
        <AdminLogoutButton />
      </div>

      <p className="mt-4 text-sm">
        <Link
          href="/admin/operations/alerts"
          className="text-[#8B6914] underline"
        >
          ← 알림 목록
        </Link>
      </p>

      <section className="mt-6 space-y-4 rounded-lg border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <div>
          <p className="text-xs text-gray-500">문제 정의</p>
          <p className="mt-1 text-gray-900">{g.definition}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">영향</p>
          <p className="mt-1 text-gray-900">{g.impact}</p>
        </div>
        {a ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">현재 값</p>
                <p className="font-medium tabular-nums">{String(a.currentValue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">정상 기준</p>
                <p className="font-medium tabular-nums">{String(a.threshold)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">상태</p>
                <p className="font-medium">
                  {a.severity} / {a.status}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">발생 횟수</p>
                <p className="font-medium tabular-nums">{a.occurrenceCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">최초 감지</p>
                <p className="tabular-nums">{a.firstDetectedAt}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">최근 감지</p>
                <p className="tabular-nums">{a.lastDetectedAt}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">자동 복구</p>
              <p>{a.autoRecoverable ? "가능 (allowlist)" : "사람 검토 필요"}</p>
            </div>
          </>
        ) : (
          <p className="text-gray-600">현재 이 규칙은 발화하지 않았습니다.</p>
        )}

        <div>
          <p className="text-xs text-gray-500">운영자가 할 일</p>
          <ul className="mt-1 list-disc pl-5 text-gray-800">
            {g.operatorSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs text-gray-500">관련 화면</p>
          <ul className="mt-1 space-y-1">
            {g.adminLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-[#8B6914] underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-gray-500">
          시스템이 재시도하는가: {g.autoRetry ? "예 (다음 스케줄)" : "아니오"} ·
          PowerShell/SQL 직접 조작 불필요
        </p>
      </section>
    </main>
  );
}
