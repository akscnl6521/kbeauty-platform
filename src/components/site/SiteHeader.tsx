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
                ? `touch-target flex items-center whitespace-nowrap py-2 text-base ${current ? "font-semibold text-[#C2185B]" : ""}`
                : `whitespace-nowrap text-sm hover:text-[#C2185B] focus-visible:outline-none ${current ? "font-semibold text-[#C2185B]" : ""}`
            }
          >
            {label}
          </Link>
        );
      })}
      {admin ? (
        <Link
          href="/admin"
          onClick={() => setOpen(false)}
          className={
            mobile
              ? "touch-target flex items-center py-2 text-base text-[#C2185B]"
              : "text-sm text-[#C2185B]"
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
                ? "touch-target flex items-center py-2 text-base font-semibold text-[#C2185B]"
                : "text-sm font-semibold text-[#C2185B]"
            }
          >
            내 피부 관리
          </Link>
          <Link
            href="/logout"
            onClick={() => setOpen(false)}
            className={
              mobile
                ? "touch-target flex items-center py-2 text-base"
                : "text-sm"
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
                ? "touch-target flex items-center py-2 text-base"
                : "text-sm"
            }
          >
            로그인
          </Link>
          <Link
            href="/signup?next=%2Fonboarding"
            onClick={() => setOpen(false)}
            className="touch-target inline-flex items-center justify-center rounded-full bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
          >
            시작하기
          </Link>
        </>
      )}
    </>
  );

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
        <nav className="hidden items-center gap-5 md:flex" aria-label="주요 메뉴">
          {nav()}
        </nav>
        <button
          type="button"
          className="touch-target inline-flex items-center justify-center rounded-lg border border-pink-100 px-3 text-lg md:hidden"
          aria-label="메뉴 열기"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/30"
          onMouseDown={() => setOpen(false)}
        >
          <div
            id={menuId}
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="모바일 메뉴"
            className="ml-auto flex h-full w-[min(18rem,85vw)] flex-col gap-1 overflow-y-auto bg-[#FAF7F5] p-6 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="touch-target mb-4 self-end rounded-lg border border-pink-100 px-3"
              aria-label="메뉴 닫기"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <nav className="flex flex-col gap-1" aria-label="모바일 메뉴">
              {nav(true)}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
