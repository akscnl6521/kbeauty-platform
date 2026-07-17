"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type QuizLink = {
  href: string;
  label: string;
  exact?: boolean;
};

const QUIZ_LINKS: QuizLink[] = [
  { href: "/quiz", label: "피부", exact: true },
  { href: "/quiz/mascara", label: "마스카라" },
  { href: "/quiz/base", label: "베이스" },
  { href: "/quiz/lip", label: "립" },
  { href: "/quiz/hair", label: "헤어·두피" },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 피부·메이크업·헤어 문진 전환 */
export function QuizDomainNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="문진 종류">
      {QUIZ_LINKS.map(({ href, label, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-[#C2185B] text-white"
                : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
