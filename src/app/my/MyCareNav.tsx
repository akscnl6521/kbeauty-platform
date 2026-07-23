"use client";

import Link from "next/link";

const LINKS = [
  { href: "/my", label: "오늘" },
  { href: "/my/profile", label: "프로필" },
  { href: "/my/routine", label: "루틴" },
  { href: "/my/check-ins", label: "체크인" },
  { href: "/my/progress", label: "변화" },
  { href: "/my/analyses", label: "분석" },
  { href: "/my/recommendations", label: "추천" },
  { href: "/my/guidance", label: "사용·상담 가이드" },
  { href: "/my/settings", label: "설정" },
];

export function MyCareNav({ current }: { current: string }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm" aria-label="내 케어">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={
            current === l.href
              ? "font-semibold text-gray-900"
              : "font-medium text-[#8B6914] underline"
          }
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
