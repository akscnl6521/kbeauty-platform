import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations/health";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Operations Alerts | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminOperationsAlertsPage() {
  await requireAdminUser();
  let snapshot;
  try {
    snapshot = await getOperationsHealthSnapshot({ persistAlerts: true });
  } catch (e) {
    if (e instanceof AdminConfigurationError) {
      return (
        <main className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-red-800">{e.message}</p>
        </main>
      );
    }
    throw e;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">운영 알림</h1>
          <p className="mt-1 text-sm text-gray-600">
            critical → warning → info 순. 동일 fingerprint는 중복 생성하지 않습니다.
          </p>
          <AdminSubnav current="operations" />
        </div>
        <AdminLogoutButton />
      </div>

      <p className="mt-4 text-sm">
        <Link href="/admin/operations" className="text-[#8B6914] underline">
          ← 운영센터
        </Link>
      </p>

      {snapshot.alerts.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600">열린 알림이 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {snapshot.alerts.map((a) => (
            <li
              key={a.fingerprint}
              className="rounded-lg border border-[#E8DFD8] bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs uppercase">
                  {a.severity}
                </span>
                <span className="text-xs text-gray-500">{a.status}</span>
                <Link
                  href={`/admin/operations/alerts/${a.code}`}
                  className="font-medium text-[#8B6914] underline"
                >
                  {a.code}
                </Link>
              </div>
              <p className="mt-1 font-medium text-gray-900">{a.title}</p>
              <p className="mt-1 text-gray-700">{a.message}</p>
              <p className="mt-1 text-xs text-gray-500">
                현재 {String(a.currentValue)} / 기준 {String(a.threshold)} ·
                발생 {a.occurrenceCount}회 · {a.lastDetectedAt}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
