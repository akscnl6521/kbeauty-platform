"use client";

import { useEffect, useState } from "react";

const EXCHANGE_RATE_API = "https://api.exchangerate-api.com/v4/latest/USD";
const CACHE_KEY = "exchangeRates";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

const DEFAULT_KRW = 1350;
const DEFAULT_JPY = 150;

type CachedRates = {
  krw: number;
  jpy: number;
  fetchedAt: number;
};

type UseExchangeRateResult = {
  krw: number;
  jpy: number;
  loading: boolean;
};

function getCached(): CachedRates | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedRates;
    if (Date.now() - data.fetchedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(krw: number, jpy: number): void {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        krw,
        jpy,
        fetchedAt: Date.now(),
      } satisfies CachedRates)
    );
  } catch {
    // ignore
  }
}

export function useExchangeRate(): UseExchangeRateResult {
  const [krw, setKrw] = useState(DEFAULT_KRW);
  const [jpy, setJpy] = useState(DEFAULT_JPY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getCached();
    if (cached) {
      setKrw(cached.krw);
      setJpy(cached.jpy);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(EXCHANGE_RATE_API)
      .then((res) => res.json())
      .then((data: { rates?: { KRW?: number; JPY?: number } }) => {
        if (cancelled) return;
        const rateKrw = data.rates?.KRW ?? DEFAULT_KRW;
        const rateJpy = data.rates?.JPY ?? DEFAULT_JPY;
        setKrw(rateKrw);
        setJpy(rateJpy);
        setCache(rateKrw, rateJpy);
      })
      .catch(() => {
        if (!cancelled) {
          setKrw(DEFAULT_KRW);
          setJpy(DEFAULT_JPY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { krw, jpy, loading };
}
