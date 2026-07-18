import Link from "next/link";
import type { ReactNode } from "react";

export function BeautyShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="kb-surface min-h-screen overflow-x-hidden text-gray-900">
      <div className="kb-noise pointer-events-none fixed inset-0 opacity-[0.035]" aria-hidden />
      <div className="relative mx-auto w-full max-w-[var(--site-content-max)] px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <header className="mb-8 max-w-3xl">
          <p className="kb-eyebrow">{eyebrow ?? "K-Beauty Match"}</p>
          <h1 className="kb-display mt-3 text-balance text-3xl leading-tight sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="kb-lead mt-4 max-w-2xl text-sm sm:text-base sm:leading-8">
              {subtitle}
            </p>
          ) : null}
        </header>
        {children}
        {footer ? <div className="mt-10">{footer}</div> : null}
        <p className="mt-12 text-xs leading-5 text-[var(--text-subtle)]">
          의료 진단이 아니며 치료를 대체하지 않습니다.{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            개인정보
          </Link>
        </p>
      </div>
    </main>
  );
}

export function QuizCard({ children }: { children: ReactNode }) {
  return <section className="kb-panel">{children}</section>;
}
