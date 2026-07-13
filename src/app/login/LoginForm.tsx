"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { customerAuthErrorMessage, mapCustomerAuthError, type CustomerAuthErrorCode } from "@/lib/auth/customer-errors";
import { sanitizeCustomerNextPath } from "@/lib/auth/safe-next";
import { loadCareStore } from "@/lib/care";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<CustomerAuthErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const next = sanitizeCustomerNextPath(search.get("next"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const { error: signInError } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError(mapCustomerAuthError(signInError.message)); return; }
      const store = loadCareStore();
      const hasLocalData = store.sessions.length + store.routines.length + store.checkIns.length > 0;
      const declined = window.sessionStorage.getItem("careAttachDeclined") === "1";
      router.push(hasLocalData && !declined ? `/auth/link-local?next=${encodeURIComponent(next)}` : next);
      router.refresh();
    } catch { setError("config"); } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
    <label className="block text-sm">이메일<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2" /></label>
    <label className="block text-sm">비밀번호<div className="mt-1 flex gap-2"><input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className="min-w-0 flex-1 rounded-lg border border-[#E8DFD8] bg-white px-3 py-2" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="text-xs text-[#C2185B]">{showPassword ? "숨기기" : "보기"}</button></div></label>
    {error && <p role="alert" className="text-sm text-rose-700">{customerAuthErrorMessage(error)}</p>}
    <button disabled={busy} className="w-full rounded-lg bg-[#C2185B] py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "로그인 중…" : "로그인"}</button>
    <div className="flex justify-between text-sm"><Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-[#C2185B] underline">회원가입</Link><Link href="/forgot-password" className="text-[#C2185B] underline">비밀번호 찾기</Link></div>
  </form>;
}
