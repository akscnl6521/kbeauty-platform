import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="kb-surface min-h-screen overflow-x-hidden px-4 py-14 text-gray-900 sm:py-16">
      <div className="mx-auto max-w-md">
        <p className="kb-eyebrow">K-Beauty Match</p>
        <h1 className="kb-display mt-3 text-balance text-3xl">피부 관리 시작하기</h1>
        <p className="kb-lead mt-2 text-sm">
          내 기록과 루틴을 안전하게 이어서 관리해요.
        </p>
        <div className="kb-panel mt-8">
          <Suspense fallback={<p className="text-sm text-[var(--text-subtle)]">준비 중…</p>}>
            <SignupForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-semibold text-[var(--brand)] underline-offset-4 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
