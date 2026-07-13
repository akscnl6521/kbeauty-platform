"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LoginUiState =
  | "idle"
  | "submitting"
  | "invalid_credentials"
  | "config_error"
  | "error";

function mapSignInError(message: string | undefined): LoginUiState {
  const m = (message ?? "").toLowerCase();
  if (
    m.includes("invalid login") ||
    m.includes("invalid credentials") ||
    m.includes("email not confirmed")
  ) {
    return "invalid_credentials";
  }
  return "error";
}

function statusMessage(state: LoginUiState): string | null {
  switch (state) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "config_error":
      return "로그인 설정을 확인할 수 없습니다.";
    case "error":
      return "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return null;
  }
}

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginUiState>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setState("invalid_credentials");
      return;
    }

    setState("submitting");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setState(mapSignInError(error.message));
        return;
      }

      router.refresh();
      router.push("/admin");
    } catch {
      setState("config_error");
    }
  }

  const message = statusMessage(state);
  const busy = state === "submitting";

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      <div>
        <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700">
          이메일
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
        />
      </div>
      <div>
        <label
          htmlFor="admin-password"
          className="block text-sm font-medium text-gray-700"
        >
          비밀번호
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
        />
      </div>
      {message ? (
        <p className="text-sm text-red-700" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-[#8B6914] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "로그인 중…" : "로그인"}
      </button>
      <p className="text-center text-sm text-gray-600">
        <Link
          href="/admin/forgot-password"
          className="font-medium text-[#8B6914] underline"
        >
          비밀번호를 잊으셨나요?
        </Link>
      </p>
    </form>
  );
}
