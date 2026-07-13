import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin unauthorized | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Legacy unauthenticated landing — redirects to login.
 */
export default function AdminUnauthorizedPage() {
  redirect("/admin/login");

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-16 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold tracking-tight">인증이 필요합니다</h1>
        <p className="mt-6">
          <Link href="/admin/login" className="text-sm font-medium text-[#8B6914] underline">
            로그인으로 이동
          </Link>
        </p>
      </div>
    </main>
  );
}
