import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminWriteCapabilityFlags } from "@/lib/auth/admin-permissions";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";
import { DiscoveryCreateForm } from "../DiscoveryCreateForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Discovery New | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Manual discovery candidate create page.
 */
export default async function AdminDiscoveryNewPage() {
  const session = await requireAdminUser();
  const caps = getAdminWriteCapabilityFlags(session.role);

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              제품 후보 등록
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Search-to-Verified 파이프라인 후보를 수동 등록합니다. verified /
              published로 생성되지 않습니다.
            </p>
            <AdminSubnav current="discovery" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-4 text-sm">
          <Link
            href="/admin/discovery"
            className="font-medium text-[#8B6914] underline"
          >
            목록으로 돌아가기
          </Link>
        </p>

        {caps.canCreateDiscovery ? (
          <DiscoveryCreateForm />
        ) : (
          <div
            className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="status"
          >
            이 작업을 수행할 권한이 없습니다. (역할: {session.role})
          </div>
        )}
      </div>
    </main>
  );
}
