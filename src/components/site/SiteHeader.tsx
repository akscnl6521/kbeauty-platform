"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const links = [
  ["피부 분석", "/analyze"],
  ["성분 가이드", "/ingredients"],
  ["내 루틴", "/routine"],
  ["내 피부 관리", "/my"],
] as const;

export function SiteHeader() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const client = createSupabaseBrowserClient();
      void client.auth.getUser().then(({ data }) => setLoggedIn(Boolean(data.user)));
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
        const focusable = menuRef.current.querySelectorAll<HTMLElement>("a, button");
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
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

  const nav = (mobile = false) => (
    <>
      {links.map(([label, href]) => (
        <Link key={href} href={href} onClick={() => setOpen(false)} className={mobile ? "py-2 text-base" : "text-sm hover:text-[#C2185B]"}>
          {label}
        </Link>
      ))}
      {admin ? <Link href="/admin" onClick={() => setOpen(false)} className="text-sm text-[#C2185B]">관리자</Link> : null}
      {loggedIn ? (
        <>
          <Link href="/my" onClick={() => setOpen(false)} className="text-sm font-medium text-[#C2185B]">내 피부 관리</Link>
          <Link href="/logout" onClick={() => setOpen(false)} className="text-sm">로그아웃</Link>
        </>
      ) : (
        <>
          <Link href="/login?next=%2Fmy" onClick={() => setOpen(false)} className="text-sm">로그인</Link>
          <Link href="/signup?next=%2Fonboarding" onClick={() => setOpen(false)} className="rounded-full bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white">시작하기</Link>
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-pink-100 bg-[#FAF7F5]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight text-[#C2185B]">K-Beauty Match</Link>
        <nav className="hidden items-center gap-5 md:flex">{nav()}</nav>
        <button type="button" className="rounded p-2 md:hidden" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen(true)}>☰</button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/30" onMouseDown={() => setOpen(false)}>
          <div ref={menuRef} role="dialog" aria-modal="true" aria-label="모바일 메뉴" className="ml-auto flex h-full w-72 flex-col gap-4 bg-[#FAF7F5] p-6 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="self-end rounded p-2" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>×</button>
            {nav(true)}
          </div>
        </div>
      ) : null}
    </header>
  );
}
