import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-5 py-20">
      <p className="text-sm font-semibold text-[#C2185B]">404</p>
      <h1 className="mt-2 text-3xl font-bold">페이지를 찾을 수 없어요</h1>
      <p className="mt-4 text-gray-600">
        주소가 변경되었거나 잘못 입력되었을 수 있습니다. K-Beauty Match 홈에서 다시 시작해 주세요.
      </p>
      <Link href="/" className="mt-8 rounded-full bg-[#C2185B] px-5 py-3 font-medium text-white">
        홈으로 가기
      </Link>
    </main>
  );
}
