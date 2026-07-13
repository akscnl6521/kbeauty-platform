import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-pink-100 bg-[#FAF7F5]">
      <div className="mx-auto max-w-[var(--site-content-max)] px-4 py-8 text-xs leading-5 text-gray-600 sm:px-6">
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="법적 안내">
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="underline-offset-2 hover:underline">
            이용약관
          </Link>
        </nav>
        <p className="mt-4">
          K-Beauty Match는 의료 진단이나 치료를 제공하지 않습니다. 지속되거나
          심한 증상은 전문가 상담을 우선하세요.
        </p>
        <p className="mt-2">
          추천은 확인된 성분·근거·판매 정보를 기준으로 하며, 구매 전 최신
          전성분과 판매 조건을 다시 확인해 주세요.
        </p>
      </div>
    </footer>
  );
}
