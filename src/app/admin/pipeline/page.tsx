import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminWriteCapabilityFlags } from "@/lib/auth/admin-permissions";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";
import { PipelineConsole } from "./PipelineConsole";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Pipeline | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminPipelinePage() {
  const session = await requireAdminUser();
  const caps = getAdminWriteCapabilityFlags(session.role);

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              자동화 파이프라인
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              브랜드·제품 자동 탐색과 분류. 사람은 needs_review만 검토합니다.
              운영 실행은 Task Scheduler + 고정 worker가 담당합니다.
            </p>
            <AdminSubnav current="pipeline" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>
        <p className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/admin/brands" className="font-medium text-[#8B6914] underline">
            브랜드 seed 목록
          </Link>
          <Link
            href="/admin/pipeline/settings"
            className="font-medium text-[#8B6914] underline"
          >
            운영 설정
          </Link>
        </p>
        <PipelineConsole canRun={caps.canRunPipeline} />
      </div>
    </main>
  );
}
