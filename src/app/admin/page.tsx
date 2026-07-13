import { requireAdminUser } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Minimal admin landing — auth confirmation only.
 * Product / discovery management UI is not implemented yet.
 */
export default async function AdminHomePage() {
  const session = await requireAdminUser();

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">관리자 인증 성공</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          서버 세션과 admin_users 검증을 통과했습니다. 제품·discovery·publish 관리
          UI는 아직 구현되지 않았습니다.
        </p>
        <dl className="mt-8 space-y-3 border-t border-[#E8DFD8] pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">role</dt>
            <dd className="font-medium">{session.role}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">active</dt>
            <dd className="font-medium">{session.active ? "true" : "false"}</dd>
          </div>
        </dl>
        <p className="mt-8 text-sm text-gray-500">
          테스트 API: <code className="text-gray-800">GET /api/admin/auth-check</code>
        </p>
      </div>
    </main>
  );
}
