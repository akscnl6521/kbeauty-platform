"use client";

import { useEffect, useMemo, useState } from "react";
import { useCountry } from "@/hooks/useCountry";
import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";

type SupportedLocale = "en" | "ja" | "ko";

const messagesMap = {
  en,
  ja,
  ko,
} as const;

export type Messages = typeof en;

type UseLocaleResult = {
  locale: SupportedLocale;
  messages: Messages;
  setLocale: (locale: SupportedLocale) => void;
};

const LOCALE_STORAGE_KEY = "locale";

function parseStoredLocale(raw: string | null): SupportedLocale | null {
  if (raw === "en" || raw === "ja" || raw === "ko") return raw;
  return null;
}

/** 브라우저 언어 → 지원 locale (명시 선택 없을 때만). */
function localeFromBrowser(): SupportedLocale | null {
  if (typeof navigator === "undefined") return null;
  const candidates = [
    navigator.language,
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
  ];
  for (const tag of candidates) {
    const lower = String(tag ?? "").toLowerCase();
    if (lower.startsWith("ko")) return "ko";
    if (lower.startsWith("ja")) return "ja";
    if (lower.startsWith("en")) return "en";
  }
  return null;
}

/**
 * 우선순위:
 * 1) 사용자 명시 선택 (localStorage)
 * 2) 브라우저 언어 ko/ja/en
 * 3) 배송/국가 코드 KR→ko, JP→ja
 * 4) 기본 ko (한국 MVP)
 */
export function resolvePreferredLocale(
  countryCode: string | null | undefined,
  stored?: string | null
): SupportedLocale {
  const fromStorage = parseStoredLocale(stored ?? null);
  if (fromStorage) return fromStorage;

  const fromBrowser = localeFromBrowser();
  if (fromBrowser === "ko" || countryCode === "KR") return "ko";
  if (fromBrowser === "ja" || countryCode === "JP") return "ja";
  if (fromBrowser === "en") return "en";
  return "ko";
}

export function useLocale(): UseLocaleResult {
  const { countryCode } = useCountry();
  const [locale, setLocaleState] = useState<SupportedLocale>("ko");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time hydrate from localStorage/navigator.language; not available during server render, must start at "ko" default and sync client-side
    setLocaleState(resolvePreferredLocale(countryCode, stored));
  }, [countryCode]);

  const setLocale = (next: SupportedLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const messages = useMemo(() => messagesMap[locale], [locale]);

  return { locale, messages, setLocale };
}
