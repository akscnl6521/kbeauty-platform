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
import { loadCareStore } from "@/lib/care";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<CustomerAuthErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const next = sanitizeCustomerNextPath(search.get("next"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } =
        await createSupabaseBrowserClient().auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      if (signInError) {
        setError(mapCustomerAuthError(signInError.message));
        return;
      }
      const store = loadCareStore();
      const hasLocalData =
        store.sessions.length + store.routines.length + store.checkIns.length >
        0;
      const declined =
        window.sessionStorage.getItem("careAttachDeclined") === "1";
      router.push(
        hasLocalData && !declined
          ? `/auth/link-local?next=${encodeURIComponent(next)}`
          : next
      );
      router.refresh();
    } catch {
      setError("config");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor={emailId} className="block text-sm font-medium">
          이메일
        </label>
        <input
          id={emailId}
          required
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2.5 text-base"
        />
      </div>
      <div>
        <label htmlFor={passwordId} className="block text-sm font-medium">
          비밀번호
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={passwordId}
            required
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-w-0 flex-1 rounded-lg border border-[#E8DFD8] bg-white px-3 py-2.5 text-base"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="touch-target shrink-0 rounded-lg border border-[#E8DFD8] px-3 text-xs text-[#C2185B]"
            aria-pressed={showPassword}
          >
            {showPassword ? "숨기기" : "보기"}
          </button>
        </div>
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
        {busy ? "로그인 중…" : "로그인"}
      </button>
      <div className="flex justify-between gap-3 text-sm">
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="text-[#C2185B] underline"
        >
          회원가입
        </Link>
        <Link href="/forgot-password" className="text-[#C2185B] underline">
          비밀번호 찾기
        </Link>
      </div>
    </form>
  );
}
