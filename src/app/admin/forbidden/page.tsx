import Link from "next/link";
import { AdminLogoutButton } from "../AdminLogoutButton";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin forbidden | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Signed-in but not an active admin_users member.
 * Session is kept; logout is offered.
 */
export default function AdminForbiddenPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-16 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold tracking-tight">관리자 권한이 없습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          이 계정으로는 관리자 영역에 접근할 수 없습니다. 다른 계정으로 로그인하려면
          로그아웃하세요.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <AdminLogoutButton className="rounded-lg bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white" />
          <Link href="/" className="text-sm font-medium text-[#8B6914] underline">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
