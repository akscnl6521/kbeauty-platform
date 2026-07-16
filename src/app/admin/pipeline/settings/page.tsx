import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";
import { PipelineSettingsForm } from "./PipelineSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Pipeline Settings | K-Beauty Match",
  robots: { index: false, follow: false },
};

export default async function AdminPipelineSettingsPage() {
  await requireAdminUser();

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              파이프라인 운영 설정
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              스케줄러는 고정 worker만 실행합니다. 한도·모드는 이 설정(및
              config 파일)에서 읽습니다.
            </p>
            <AdminSubnav current="pipeline" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>
        <p className="mt-4 text-sm">
          <Link
            href="/admin/pipeline"
            className="font-medium text-[#8B6914] underline"
          >
            ← 파이프라인 콘솔
          </Link>
        </p>
        <PipelineSettingsForm />
      </div>
    </main>
  );
}
