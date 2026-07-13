import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const message = code === "recovery_failed"
    ? "비밀번호 재설정 링크가 만료되었거나 사용할 수 없습니다."
    : "인증을 완료하지 못했습니다. 다시 시도해 주세요.";
  return <main className="mx-auto min-h-[60vh] max-w-lg px-5 py-20">
    <h1 className="text-2xl font-bold">인증을 완료하지 못했습니다</h1>
    <p className="mt-4 text-gray-600">{message}</p>
    <div className="mt-8 flex gap-3"><Link href="/login" className="rounded-full bg-[#C2185B] px-5 py-3 text-white">로그인 다시 하기</Link><Link href="/forgot-password" className="rounded-full border border-[#C2185B] px-5 py-3 text-[#C2185B]">재설정 링크 받기</Link></div>
  </main>;
}
