"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ResetUiState =
  | "checking"
  | "ready"
  | "no_session"
  | "submitting"
  | "success"
  | "mismatch"
  | "too_short"
  | "error";

const MIN_PASSWORD_LENGTH = 12;

function statusMessage(state: ResetUiState): string | null {
  switch (state) {
    case "checking":
      return "재설정 세션을 확인하는 중…";
    case "no_session":
      return "유효한 재설정 세션이 없습니다. 메일을 다시 요청해 주세요.";
    case "mismatch":
      return "비밀번호가 일치하지 않습니다.";
    case "too_short":
      return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
    case "error":
      return "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    case "success":
      return "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.";
    default:
      return null;
  }
}

/**
 * Assumes /auth/callback already exchanged the PKCE code into cookies.
 * Does not call exchangeCodeForSession here.
 */
export function AdminResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<ResetUiState>("checking");

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function verifyRecoverySession() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;
        setState(user ? "ready" : "no_session");
      } catch {
        if (!cancelled) setState("no_session");
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setState("ready");
      }
    });

    void verifyRecoverySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting" || state !== "ready") return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setState("too_short");
      return;
    }
    if (password !== confirm) {
      setState("mismatch");
      return;
    }

    setState("submitting");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setState("error");
        return;
      }

      await supabase.auth.signOut();
      setState("success");
      router.refresh();
      router.push("/admin/login");
    } catch {
      setState("error");
    }
  }

  const message = statusMessage(state);
  const busy = state === "submitting" || state === "checking";
  const formEnabled =
    state === "ready" ||
    state === "mismatch" ||
    state === "too_short" ||
    state === "error";
  const messageTone =
    state === "success" || state === "checking" ? "text-gray-700" : "text-red-700";

  if (state === "no_session") {
    return (
      <div className="mt-8 space-y-4">
        <p className="text-sm text-red-700" role="alert">
          {statusMessage("no_session")}
        </p>
        <a
          href="/admin/forgot-password"
          className="inline-block text-sm font-medium text-[#8B6914] underline"
        >
          비밀번호 재설정 다시 요청
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      <div>
        <label
          htmlFor="admin-new-password"
          className="block text-sm font-medium text-gray-700"
        >
          새 비밀번호
        </label>
        <input
          id="admin-new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!formEnabled || busy}
          className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B6914]"
        />
        <p className="mt-1 text-xs text-gray-500">
          {MIN_PASSWORD_LENGTH}자 이상 권장
        </p>
      </div>
      <div>
        <label
          htmlFor="admin-confirm-password"
          className="block text-sm font-medium text-gray-700"
        >
          비밀번호 확인
        </label>
        <input
          id="admin-confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={!formEnabled || busy}
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
        disabled={!formEnabled || busy}
        className="w-full rounded-lg bg-[#8B6914] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy && state === "submitting"
          ? "변경 중…"
          : state === "checking"
            ? "확인 중…"
            : "비밀번호 변경"}
      </button>
    </form>
  );
}
