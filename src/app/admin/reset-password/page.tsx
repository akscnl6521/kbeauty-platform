import Link from "next/link";
import { AdminResetPasswordForm } from "./AdminResetPasswordForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Reset Password | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Admin new-password form after recovery link. Public path (guard skipped).
 */
export default function AdminResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-16 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          새 비밀번호 설정
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          이메일 링크로 들어온 경우에만 새 비밀번호를 설정할 수 있습니다.
        </p>
        <AdminResetPasswordForm />
        <p className="mt-6 text-sm text-gray-600">
          <Link
            href="/admin/forgot-password"
            className="font-medium text-[#8B6914] underline"
          >
            재설정 메일 다시 요청
          </Link>
          {" · "}
          <Link href="/admin/login" className="font-medium text-[#8B6914] underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
