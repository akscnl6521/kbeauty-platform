import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin forbidden | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Shown when the user is signed in but not an active admin_users member.
 * Does not display role, UUID, or email.
 */
export default function AdminForbiddenPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-16 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold tracking-tight">관리자 권한이 없습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          이 계정으로는 관리자 영역에 접근할 수 없습니다.
        </p>
        <p className="mt-6">
          <Link href="/" className="text-sm font-medium text-[#8B6914] underline">
            홈으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  );
}
