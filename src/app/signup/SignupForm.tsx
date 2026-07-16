"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import {
  customerAuthErrorMessage,
  mapCustomerAuthError,
  type CustomerAuthErrorCode,
} from "@/lib/auth/customer-errors";
import { sanitizeCustomerNextPath } from "@/lib/auth/safe-next";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const confirmId = `${formId}-confirm`;
  const errorId = `${formId}-error`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState<CustomerAuthErrorCode | null>(null);
  const next = sanitizeCustomerNextPath(search.get("next"), "/onboarding");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError("weak_password");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const { data, error: signUpError } = await createSupabaseBrowserClient().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
      });
      if (signUpError) {
        setError(mapCustomerAuthError(signUpError.message));
        return;
      }
      if (!data.session) {
        setNotice(true);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("config");
    } finally {
      setBusy(false);
    }
  }

  if (notice) {
    return (
      <p className="mt-6 rounded-lg bg-pink-50 p-4 text-sm text-[#8B1744]" role="status">
        인증 메일을 확인하세요. 이메일 인증 후 피부 관리 설정을 이어갈 수 있어요. (재전송은 메일함
        스팸함 확인 후 다시 가입을 시도해 주세요.)
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-6 w-full max-w-md space-y-4" noValidate>
      <div>
        <label htmlFor={emailId} className="block text-sm font-medium text-[#1a1a1a]">
          이메일
        </label>
        <input
          id={emailId}
          required
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2.5 text-base"
        />
      </div>
      <div>
        <label htmlFor={passwordId} className="block text-sm font-medium text-[#1a1a1a]">
          비밀번호
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={passwordId}
            required
            minLength={8}
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="w-full min-w-0 rounded-lg border border-[#E8DFD8] px-3 py-2.5 text-base"
          />
          <button
            type="button"
            className="touch-target shrink-0 rounded-lg border border-[#E8DFD8] px-3 text-sm"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? "숨김" : "표시"}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor={confirmId} className="block text-sm font-medium text-[#1a1a1a]">
          비밀번호 확인
        </label>
        <input
          id={confirmId}
          required
          type={showPassword ? "text" : "password"}
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2.5 text-base"
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-rose-700">
          {customerAuthErrorMessage(error)}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="touch-target w-full rounded-lg bg-[#C2185B] py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "가입 중…" : "회원가입"}
      </button>
      <p className="text-center text-sm">
        이미 계정이 있나요?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="text-[#C2185B] underline"
        >
          로그인
        </Link>
      </p>
      <p className="text-center text-xs text-[#6B5E57]">
        가입 시{" "}
        <Link href="/privacy" className="underline">
          개인정보 처리방침
        </Link>
        과{" "}
        <Link href="/terms" className="underline">
          이용약관
        </Link>
        에 동의합니다.
      </p>
    </form>
  );
}
