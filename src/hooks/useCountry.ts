"use client";

import { useCallback, useEffect, useState } from "react";
import {
  normalizeShippingCountry,
  type ShippingCountry,
} from "@/lib/recommend/selectPurchaseLink";

export type { ShippingCountry };

type UseCountryResult = {
  /** 사용자가 선택한 배송 국가 (KR/US/JP). IP보다 localStorage 선택이 우선. */
  countryCode: ShippingCountry | null;
  loading: boolean;
  error: string | null;
  /** 배송 국가 직접 선택 — 구매처 재계산에 즉시 반영 */
  setShippingCountry: (code: ShippingCountry) => void;
};

type IpApiResponse = {
  country_code?: string;
};

const STORAGE_KEY = "countryCode";

export function useCountry(): UseCountryResult {
  const [countryCode, setCountryCode] = useState<ShippingCountry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setShippingCountry = useCallback((code: ShippingCountry) => {
    setCountryCode(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchCountryFromIp() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) {
          throw new Error(`ipapi.co request failed with status ${res.status}`);
        }
        const data: IpApiResponse = await res.json();
        if (cancelled) return;

        // 이미 사용자가 저장한 값이 있으면 IP로 덮어쓰지 않음
        try {
          const saved = window.localStorage.getItem(STORAGE_KEY);
          const savedNorm = normalizeShippingCountry(saved);
          if (savedNorm) {
            setCountryCode(savedNorm);
            return;
          }
        } catch {
          // ignore
        }

        const fromIp = normalizeShippingCountry(data.country_code ?? null);
        if (fromIp) {
          setCountryCode(fromIp);
          try {
            window.localStorage.setItem(STORAGE_KEY, fromIp);
          } catch {
            // ignore
          }
        } else {
          // KR/US/JP 외 IP → 기본 KR (구매처 폴백용)
          setCountryCode("KR");
          try {
            window.localStorage.setItem(STORAGE_KEY, "KR");
          } catch {
            // ignore
          }
        }
      } catch {
        if (!cancelled) {
          setCountryCode("KR");
          setError("country_detect_failed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    // 사용자 선택(localStorage)을 IP보다 우선
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const savedNorm = normalizeShippingCountry(saved);
      if (savedNorm) {
        setCountryCode(savedNorm);
        setLoading(false);
        return;
      }
    } catch {
      // ignore
    }

    fetchCountryFromIp();

    return () => {
      cancelled = true;
    };
  }, []);

  return { countryCode, loading, error, setShippingCountry };
}
