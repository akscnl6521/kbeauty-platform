import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-[var(--section-y)] border-t border-line bg-surface-sunken">
      <div className="kb-shell py-14 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-16">
          <div className="kb-prose">
            <p className="kb-display text-step-1">K-Beauty Match</p>
            <p className="mt-3 text-[0.9375rem] leading-7 text-ink-2">
              피부를 먼저 이해하고, 확인된 근거가 있는 제품만 안내합니다.
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem] text-ink-2"
            aria-label="법적 안내"
          >
            <Link
              href="/privacy"
              className="underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              개인정보처리방침
            </Link>
            <Link
              href="/terms"
              className="underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              이용약관
            </Link>
          </nav>
        </div>

        <hr className="kb-rule my-10" />

        <div className="grid gap-4 text-[0.8125rem] leading-6 text-ink-3 sm:grid-cols-2 sm:gap-10">
          <p>
            K-Beauty Match는 의료 진단이나 치료를 제공하지 않습니다. 지속되거나
            심한 증상은 전문가 상담을 우선하세요.
          </p>
          <p>
            추천은 확인된 성분·근거·판매 정보를 기준으로 하며, 구매 전 최신
            전성분과 판매 조건을 다시 확인해 주세요.
          </p>
        </div>
      </div>
    </footer>
  );
}
