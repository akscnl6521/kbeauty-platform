import Link from "next/link";
import { AdminForgotPasswordForm } from "./AdminForgotPasswordForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Forgot Password | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Admin password reset request (public). Does not reveal whether the email exists.
 */
export default async function AdminForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const recoveryFailed = params.error === "recovery_failed";

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-16 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          비밀번호 재설정
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          등록된 관리자 이메일을 입력하면 재설정 안내를 보냅니다.
        </p>
        {recoveryFailed ? (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            재설정 링크가 만료되었거나 세션을 만들지 못했습니다. 메일을 다시
            요청해 주세요.
          </p>
        ) : null}
        <AdminForgotPasswordForm />
        <p className="mt-6 text-sm text-gray-600">
          <Link href="/admin/login" className="font-medium text-[#8B6914] underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  );
}
