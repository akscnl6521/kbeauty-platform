import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin unavailable | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Safe screen when admin server configuration is incomplete
 * (e.g. missing SUPABASE_SERVICE_ROLE_KEY). No secrets shown.
 */
export default function AdminUnavailablePage() {
  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-16 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold tracking-tight">관리자 기능을 사용할 수 없습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          서버 설정이 완료되지 않아 관리자 권한을 확인할 수 없습니다. 환경변수
          설정을 점검한 뒤 다시 시도하세요.
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
