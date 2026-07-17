"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const links = [
  ["피부 문진", "/quiz"],
  ["피부 분석", "/analyze"],
  ["페이스 탐색", "/face-explorer"],
  ["추천 결과", "/results"],
  ["성분 가이드", "/ingredients"],
  ["내 루틴", "/routine"],
] as const;

const quizLinks = [
  ["마스카라", "/quiz/mascara"],
  ["베이스", "/quiz/base"],
  ["립", "/quiz/lip"],
  ["헤어·두피", "/quiz/hair"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    try {
      const client = createSupabaseBrowserClient();
      void client.auth.getUser().then(({ data }) =>
        setLoggedIn(Boolean(data.user))
      );
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        setLoggedIn(Boolean(session?.user));
      });
      return () => data.subscription.unsubscribe();
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      setAdmin(false);
      return;
    }
    void fetch("/api/admin/auth-check", { credentials: "include" })
      .then((response) => setAdmin(response.ok))
      .catch(() => setAdmin(false));
  }, [loggedIn]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab" && menuRef.current) {
        const focusable = menuRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])"
        );
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (mq.matches) setOpen(false);
    };
    closeOnDesktop();
    mq.addEventListener("change", closeOnDesktop);
    return () => mq.removeEventListener("change", closeOnDesktop);
  }, []);

  function isCurrent(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const desktopNav = (
    <>
      {links.map(([label, href]) => {
        const current = isCurrent(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`whitespace-nowrap text-sm hover:text-[#C2185B] focus-visible:outline-none ${
              current ? "font-semibold text-[#C2185B]" : ""
            }`}
          >
            {label}
          </Link>
        );
      })}
      {admin ? (
        <Link href="/admin" className="text-sm text-[#C2185B]">
          관리자
        </Link>
      ) : null}
      {loggedIn ? (
        <>
          <Link
            href="/my"
            aria-current={isCurrent("/my") ? "page" : undefined}
            className="text-sm font-semibold text-[#C2185B]"
          >
            내 피부 관리
          </Link>
          <Link href="/logout" className="text-sm">
            로그아웃
          </Link>
        </>
      ) : (
        <>
          <Link href="/login?next=%2Fmy" className="text-sm">
            로그인
          </Link>
          <Link
            href="/signup?next=%2Fonboarding"
            className="touch-target inline-flex items-center justify-center rounded-full bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
          >
            시작하기
          </Link>
        </>
      )}
    </>
  );

  const mobileLinkClass = (current: boolean, accent = false) =>
    `touch-target flex min-h-11 items-center border-b border-pink-100 py-3 text-base ${
      current || accent ? "font-semibold text-[#C2185B]" : "text-gray-800"
    }`;

  return (
    <header
      className="sticky top-0 z-40 border-b border-pink-100 bg-[#FAF7F5]/95 backdrop-blur"
      style={{ minHeight: "var(--site-header-height)" }}
    >
      <div className="mx-auto flex h-[var(--site-header-height)] max-w-[var(--site-content-max)] items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-semibold tracking-tight text-[#C2185B]"
        >
          K-Beauty Match
        </Link>
        {/* lg부터 가로 메뉴 — md는 링크가 너무 촘촘함 */}
        <nav
          className="hidden items-center gap-4 lg:flex xl:gap-5"
          aria-label="주요 메뉴"
        >
          {desktopNav}
        </nav>
        <button
          type="button"
          className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-pink-100 text-lg lg:hidden"
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "×" : "☰"}
        </button>
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            id={menuId}
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="모바일 메뉴"
            className="ml-auto flex h-full w-[min(20rem,88vw)] flex-col overflow-y-auto bg-[#FAF7F5] p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#C2185B]">메뉴</p>
              <button
                type="button"
                className="touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-pink-100 text-xl"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <nav className="flex flex-col" aria-label="모바일 메뉴">
              {links.map(([label, href]) => {
                const current = isCurrent(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={current ? "page" : undefined}
                    className={mobileLinkClass(current)}
                  >
                    {label}
                  </Link>
                );
              })}
              {admin ? (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className={mobileLinkClass(false, true)}
                >
                  관리자
                </Link>
              ) : null}
              <p className="pb-1 pt-4 text-xs font-semibold tracking-wide text-gray-500">
                메이크업 · 헤어 문진
              </p>
              {quizLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent(href) ? "page" : undefined}
                  className={mobileLinkClass(isCurrent(href))}
                >
                  {label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-2 pt-2">
                {loggedIn ? (
                  <>
                    <Link
                      href="/my"
                      onClick={() => setOpen(false)}
                      className="touch-target flex min-h-11 items-center justify-center rounded-full border border-[#C2185B] px-4 text-sm font-semibold text-[#C2185B]"
                    >
                      내 피부 관리
                    </Link>
                    <Link
                      href="/logout"
                      onClick={() => setOpen(false)}
                      className="touch-target flex min-h-11 items-center justify-center rounded-full border border-[#E8DFD8] px-4 text-sm"
                    >
                      로그아웃
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login?next=%2Fmy"
                      onClick={() => setOpen(false)}
                      className="touch-target flex min-h-11 items-center justify-center rounded-full border border-[#E8DFD8] px-4 text-sm"
                    >
                      로그인
                    </Link>
                    <Link
                      href="/signup?next=%2Fonboarding"
                      onClick={() => setOpen(false)}
                      className="touch-target flex min-h-11 items-center justify-center rounded-full bg-[#C2185B] px-4 text-sm font-semibold text-white"
                    >
                      시작하기
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
