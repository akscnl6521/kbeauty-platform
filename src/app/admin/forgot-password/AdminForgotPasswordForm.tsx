"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ForgotUiState = "idle" | "submitting" | "sent" | "invalid" | "error";

function statusMessage(state: ForgotUiState): string | null {
  switch (state) {
    case "sent":
      return "입력하신 주소로 안내를 보냈습니다. 메일이 없다면 스팸함도 확인해 주세요.";
    case "invalid":
      return "올바른 이메일 주소를 입력해 주세요.";
    case "error":
      return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return null;
  }
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AdminForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ForgotUiState>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !isPlausibleEmail(trimmedEmail)) {
      setState("invalid");
      return;
    }

    setState("submitting");

    try {
      const supabase = createSupabaseBrowserClient();
      // PKCE: land on server callback first so the code is exchanged into cookies.
      const redirectTo = `${window.location.origin}/auth/callback?next=/admin/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      });

      if (error) {
        setState("error");
        return;
      }

      setState("sent");
    } catch {
      setState("error");
    }
  }

  const message = statusMessage(state);
  const busy = state === "submitting";
  const messageTone = state === "sent" ? "text-gray-700" : "text-red-700";

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      <div>
        <label
          htmlFor="admin-forgot-email"
          className="block text-sm font-medium text-gray-700"
        >
          이메일
        </label>
        <input
          id="admin-forgot-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || state === "sent"}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
        />
      </div>
      {message ? (
        <p className={`text-sm ${messageTone}`} role="status">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || state === "sent"}
        className="w-full rounded-lg bg-[#8B6914] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "요청 중…" : state === "sent" ? "요청 완료" : "재설정 메일 보내기"}
      </button>
    </form>
  );
}
