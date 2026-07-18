import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerUser } from "@/lib/auth/customer";
import { sanitizeCustomerNextPath } from "@/lib/auth/safe-next";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [user, query] = await Promise.all([getCustomerUser(), searchParams]);
  if (user) redirect(sanitizeCustomerNextPath(query.next));

  return (
    <main className="kb-surface min-h-screen overflow-x-hidden px-4 py-14 text-gray-900 sm:py-16">
      <div className="mx-auto max-w-md">
        <p className="kb-eyebrow">K-Beauty Match</p>
        <h1 className="kb-display mt-3 text-balance text-3xl">다시 만나서 반가워요</h1>
        <p className="kb-lead mt-2 text-sm">
          내 피부 관리 기록을 이어서 확인하세요.
        </p>
        <div className="kb-panel mt-8">
          <Suspense fallback={<p className="text-sm text-[var(--text-subtle)]">불러오는 중…</p>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          계정이 없나요?{" "}
          <Link href="/signup" className="font-semibold text-[var(--brand)] underline-offset-4 hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </main>
  );
}
