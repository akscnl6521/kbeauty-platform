"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (busy) return; setBusy(true); try { await createSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` }); } finally { setBusy(false); setSent(true); } }
  return <main className="min-h-screen bg-[#FAF7F5] px-4 py-16"><div className="mx-auto max-w-md rounded-2xl bg-white p-6"><h1 className="text-2xl font-bold">비밀번호 찾기</h1>{sent ? <p className="mt-5 text-sm">가입 여부와 관계없이, 가능한 경우 재설정 안내를 이메일로 보냈습니다.</p> : <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm">이메일<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2" /></label><button disabled={busy} className="w-full rounded-lg bg-[#C2185B] py-2 text-white">{busy ? "전송 중…" : "재설정 메일 보내기"}</button></form>}<Link href="/login" className="mt-5 inline-block text-sm text-[#C2185B] underline">로그인으로 돌아가기</Link></div></main>;
}
