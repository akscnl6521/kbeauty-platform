import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-pink-100 bg-[#FAF7F5]">
      <div className="mx-auto max-w-[var(--site-content-max)] px-4 py-8 text-xs leading-5 text-gray-600 sm:px-6">
        <nav
          className="flex flex-wrap gap-x-5 gap-y-2"
          aria-label="주요 바로가기"
        >
          <Link href="/quiz" className="underline-offset-2 hover:underline">
            피부 문진
          </Link>
          <Link href="/analyze" className="underline-offset-2 hover:underline">
            피부 분석
          </Link>
          <Link
            href="/face-explorer"
            className="underline-offset-2 hover:underline"
          >
            페이스 탐색
          </Link>
          <Link href="/results" className="underline-offset-2 hover:underline">
            추천 결과
          </Link>
          <Link href="/routine" className="underline-offset-2 hover:underline">
            내 루틴
          </Link>
        </nav>
        <nav
          className="mt-3 flex flex-wrap gap-x-5 gap-y-2"
          aria-label="메이크업·헤어 문진"
        >
          <Link
            href="/quiz/mascara"
            className="underline-offset-2 hover:underline"
          >
            마스카라 문진
          </Link>
          <Link
            href="/quiz/base"
            className="underline-offset-2 hover:underline"
          >
            베이스 문진
          </Link>
          <Link href="/quiz/lip" className="underline-offset-2 hover:underline">
            립 문진
          </Link>
          <Link
            href="/quiz/hair"
            className="underline-offset-2 hover:underline"
          >
            헤어 문진
          </Link>
        </nav>
        <nav
          className="mt-3 flex flex-wrap gap-x-5 gap-y-2"
          aria-label="법적 안내"
        >
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
