import { redirect } from "next/navigation";
import { getAdminSession, getAuthenticatedUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { AdminLoginForm } from "./AdminLoginForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Login | K-Beauty Match",
  robots: { index: false, follow: false },
};

/**
 * Admin login entry. Auth success alone is not enough —
 * /admin layout re-checks admin_users.
 */
export default async function AdminLoginPage() {
  let configurationIncomplete = false;
  let session: Awaited<ReturnType<typeof getAdminSession>> = null;

  try {
    session = await getAdminSession();
  } catch (error) {
    if (error instanceof AdminConfigurationError) {
      configurationIncomplete = true;
    }
  }

  // redirect() signals by throwing NEXT_REDIRECT, so it must stay outside the
  // try above — the catch would swallow that signal, the redirect would never
  // happen, and the client router would re-request this page in a tight loop.
  if (session) {
    redirect("/admin");
  }

  const user = await getAuthenticatedUser();

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-16 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">관리자 로그인</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          로그인 후 서버에서 관리자 권한을 다시 확인합니다.
        </p>
        {configurationIncomplete ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            서버 관리자 설정이 완료되지 않아 로그인 후에도 관리자 영역을 열 수
            없을 수 있습니다.
          </p>
        ) : null}
        {user ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            현재 세션은 있으나 관리자 권한이 없습니다. 다른 계정으로 로그인하거나
            로그아웃 후 다시 시도하세요.
          </p>
        ) : null}
        <AdminLoginForm />
        {user ? (
          <form action="/admin/logout" method="post" className="mt-4">
            <button
              type="submit"
              className="text-sm font-medium text-[#8B6914] underline"
            >
              로그아웃
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
