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

export function useLocale(): UseLocaleResult {
  const { countryCode } = useCountry();
  const [locale, setLocaleState] = useState<SupportedLocale>("en");

  // 초기 로딩: localStorage → countryCode 기반 추론
  useEffect(() => {
    let initial: SupportedLocale | null = null;
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === "en" || saved === "ja" || saved === "ko") {
        initial = saved;
      }
    } catch {
      // ignore
    }

    if (!initial) {
      if (countryCode === "KR") {
        initial = "ko";
      } else if (countryCode === "JP") {
        initial = "ja";
      } else {
        initial = "en";
      }
    }

    setLocaleState(initial);
  }, [countryCode]);

  const setLocale = (next: SupportedLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const messages = useMemo(() => {
    return messagesMap[locale];
  }, [locale]);

  return { locale, messages, setLocale };
}

