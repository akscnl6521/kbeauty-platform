import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin unauthorized | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Shown when /admin is hit without a valid Auth session.
 * Full login UI is intentionally not implemented in this sprint.
 */
export default function AdminUnauthorizedPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-16 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold tracking-tight">인증이 필요합니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          관리자 영역에 접근하려면 로그인된 Supabase Auth 세션이 필요합니다. 현재
          앱에는 관리자 로그인 페이지가 아직 없습니다.
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
