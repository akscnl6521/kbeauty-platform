"use client";

import Link from "next/link";

const LINKS = [
  { href: "/my", label: "오늘" },
  { href: "/my/routine", label: "루틴" },
  { href: "/my/check-ins", label: "체크인" },
  { href: "/my/progress", label: "변화" },
  { href: "/my/analyses", label: "분석" },
  { href: "/my/recommendations", label: "추천" },
  { href: "/my/settings", label: "설정" },
];

export function MyCareNav({ current }: { current: string }) {
  return (
    <nav
      className="mt-4 flex flex-wrap gap-2"
      aria-label="내 케어"
    >
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={
            current === l.href
              ? "touch-target inline-flex min-h-10 items-center rounded-full bg-[#C2185B] px-3 py-2 text-sm font-semibold text-white"
              : "touch-target inline-flex min-h-10 items-center rounded-full border border-[#E8DFD8] bg-white px-3 py-2 text-sm font-medium text-gray-800"
          }
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
