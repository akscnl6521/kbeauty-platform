import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-pink-100 bg-[#FAF7F5]">
      <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-gray-600 sm:px-6">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/terms">이용약관</Link>
        </div>
        <p className="mt-4">K-Beauty Match는 의료 진단이나 치료를 제공하지 않으며, 지속되거나 심한 증상은 전문가 상담이 우선입니다.</p>
        <p className="mt-2">추천은 확인된 성분 정보·근거·판매 정보를 기준으로 하며, 구매 전 최신 전성분과 판매 조건을 다시 확인해 주세요.</p>
      </div>
    </footer>
  );
}
