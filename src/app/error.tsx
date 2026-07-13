"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영 환경에서 오류 내용이나 사용자 정보를 화면에 노출하지 않는다.
    console.error("[app-error]", error.digest ?? "unknown");
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-5 py-20">
      <h1 className="text-3xl font-bold">잠시 문제가 발생했어요</h1>
      <p className="mt-4 text-gray-600">
        요청을 처리하지 못했습니다. 잠시 후 다시 시도하거나 홈으로 돌아가 주세요.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-[#C2185B] px-5 py-3 font-medium text-white"
        >
          다시 시도
        </button>
        <Link href="/" className="rounded-full border border-[#C2185B] px-5 py-3 font-medium text-[#C2185B]">
          홈으로 가기
        </Link>
      </div>
    </main>
  );
}
