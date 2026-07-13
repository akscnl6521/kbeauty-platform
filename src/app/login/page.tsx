import { Suspense } from "react";
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
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-16 text-gray-900">
      <div className="mx-auto max-w-md rounded-2xl border border-[#E8DFD8] bg-white p-6">
        <h1 className="text-2xl font-bold tracking-tight">다시 만나서 반가워요</h1>
        <p className="mt-2 text-sm text-gray-600">
          내 피부 관리 기록을 이어서 확인하세요.
        </p>
        <Suspense fallback={<p className="mt-6 text-sm text-gray-500">불러오는 중…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
