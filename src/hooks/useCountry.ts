"use client";

import { useEffect, useState } from "react";

type UseCountryResult = {
  countryCode: string | null;
  loading: boolean;
  error: string | null;
};

type IpApiResponse = {
  country_code?: string;
};

export function useCountry(): UseCountryResult {
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCountry() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) {
          throw new Error(`ipapi.co request failed with status ${res.status}`);
        }
        const data: IpApiResponse = await res.json();
        if (cancelled) return;
        if (data.country_code) {
          setCountryCode(data.country_code);
          try {
            window.localStorage.setItem("countryCode", data.country_code);
          } catch {
            // ignore storage errors
          }
        } else {
          setCountryCode(null);
        }
      } catch {
        if (!cancelled) {
          setCountryCode("KR");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    // 먼저 localStorage에 저장된 국가 코드가 있으면 사용
    try {
      const saved = window.localStorage.getItem("countryCode");
      if (saved) {
        setCountryCode(saved);
        setLoading(false);
        return;
      }
    } catch {
      // ignore
    }

    fetchCountry();

    return () => {
      cancelled = true;
    };
  }, []);

  return { countryCode, loading, error };
}

