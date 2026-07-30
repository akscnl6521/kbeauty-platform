"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const links = [
  ["피부 분석", "/analyze"],
  ["성분 가이드", "/ingredients"],
  ["내 루틴", "/routine"],
  ["내 피부 관리", "/my"],
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
    if (!loggedIn) return;
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

  function isCurrent(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const nav = (mobile = false) => (
    <>
      {links.map(([label, href]) => {
        const current = isCurrent(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={current ? "page" : undefined}
            className={
              mobile
                ? `touch-target flex items-center whitespace-nowrap border-b border-line py-3 text-[1.0625rem] ${current ? "font-semibold text-brand" : "text-ink-2"}`
                : `whitespace-nowrap text-[0.9375rem] transition-colors hover:text-brand ${current ? "font-semibold text-brand" : "text-ink-2"}`
            }
          >
            {label}
          </Link>
        );
      })}
      {loggedIn && admin ? (
        <Link
          href="/admin"
          onClick={() => setOpen(false)}
          className={
            mobile
              ? "touch-target flex items-center border-b border-line py-3 text-[1.0625rem] text-ink-3"
              : "text-[0.9375rem] text-ink-3 transition-colors hover:text-ink"
          }
        >
          관리자
        </Link>
      ) : null}
      {loggedIn ? (
        <>
          <Link
            href="/my"
            onClick={() => setOpen(false)}
            aria-current={isCurrent("/my") ? "page" : undefined}
            className={
              mobile
                ? "touch-target flex items-center border-b border-line py-3 text-[1.0625rem] font-semibold text-brand"
                : "text-[0.9375rem] font-semibold text-brand"
            }
          >
            내 피부 관리
          </Link>
          <Link
            href="/logout"
            onClick={() => setOpen(false)}
            className={
              mobile
                ? "touch-target flex items-center py-3 text-[1.0625rem] text-ink-3"
                : "text-[0.9375rem] text-ink-3 transition-colors hover:text-ink"
            }
          >
            로그아웃
          </Link>
        </>
      ) : (
        <>
          <Link
            href="/login?next=%2Fmy"
            onClick={() => setOpen(false)}
            className={
              mobile
                ? "touch-target flex items-center border-b border-line py-3 text-[1.0625rem] text-ink-2"
                : "text-[0.9375rem] text-ink-2 transition-colors hover:text-ink"
            }
          >
            로그인
          </Link>
          <Link
            href="/signup?next=%2Fonboarding"
            onClick={() => setOpen(false)}
            className={
              mobile
                ? "kb-cta mt-5 w-full"
                : "touch-target inline-flex items-center justify-center rounded-full border border-ink px-5 py-2 text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-ink hover:text-paper"
            }
          >
            시작하기
          </Link>
        </>
      )}
    </>
  );

  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md"
      style={{ minHeight: "var(--site-header-height)" }}
    >
      <div className="mx-auto flex h-[var(--site-header-height)] max-w-[var(--site-content-max)] items-center justify-between gap-3 px-[var(--site-gutter)]">
        <Link
          href="/"
          className="group flex shrink-0 items-baseline gap-2"
          aria-label="K-Beauty Match 홈"
        >
          <span className="kb-display text-[1.0625rem] tracking-tight sm:text-[1.1875rem]">
            K-Beauty Match
          </span>
          <span
            aria-hidden
            className="hidden h-1 w-1 rounded-full bg-brand sm:block"
          />
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="주요 메뉴">
          {nav()}
        </nav>
        <button
          type="button"
          className="touch-target -mr-2 inline-flex items-center justify-center rounded-md px-2 text-ink-2 md:hidden"
          aria-label="메뉴 열기"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen(true)}
        >
          <svg
            width="20"
            height="14"
            viewBox="0 0 20 14"
            fill="none"
            aria-hidden
          >
            <path
              d="M0 1h20M0 7h20M0 13h13"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        </button>
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-[#2a1c14]/35"
          onMouseDown={() => setOpen(false)}
        >
          <div
            id={menuId}
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="모바일 메뉴"
            className="ml-auto flex h-full w-[min(20rem,88vw)] flex-col overflow-y-auto bg-paper px-6 py-5 shadow-[var(--kb-shadow-paper)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="kb-eyebrow">메뉴</span>
              <button
                type="button"
                className="touch-target -mr-2 inline-flex items-center justify-center rounded-md px-2 text-ink-2"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M1 1l14 14M15 1L1 15"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              </button>
            </div>
            <nav className="mt-4 flex flex-col" aria-label="모바일 메뉴">
              {nav(true)}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
