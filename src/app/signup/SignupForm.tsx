"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { customerAuthErrorMessage, mapCustomerAuthError, type CustomerAuthErrorCode } from "@/lib/auth/customer-errors";
import { sanitizeCustomerNextPath } from "@/lib/auth/safe-next";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignupForm() {
  const router = useRouter(); const search = useSearchParams();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(false); const [error, setError] = useState<CustomerAuthErrorCode | null>(null);
  const next = sanitizeCustomerNextPath(search.get("next"), "/onboarding");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    if (password !== confirm) { setError("weak_password"); return; }
    setBusy(true); setError(null);
    try {
      const origin = window.location.origin;
      const { data, error: signUpError } = await createSupabaseBrowserClient().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` } });
      if (signUpError) { setError(mapCustomerAuthError(signUpError.message)); return; }
      if (!data.session) { setNotice(true); return; }
      router.push(next); router.refresh();
    } catch { setError("config"); } finally { setBusy(false); }
  }
  if (notice) return <p className="mt-6 rounded-lg bg-pink-50 p-4 text-sm text-[#8B1744]">인증 메일을 확인하세요. 이메일 인증 후 피부 관리 설정을 이어갈 수 있어요.</p>;
  return <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm">이메일<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2" /></label><label className="block text-sm">비밀번호<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2" /></label><label className="block text-sm">비밀번호 확인<input required type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2" /></label>{error && <p role="alert" className="text-sm text-rose-700">{customerAuthErrorMessage(error)}</p>}<button disabled={busy} className="w-full rounded-lg bg-[#C2185B] py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "가입 중…" : "회원가입"}</button><p className="text-center text-sm">이미 계정이 있나요? <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-[#C2185B] underline">로그인</Link></p></form>;
}
