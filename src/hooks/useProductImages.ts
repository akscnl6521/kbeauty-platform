"use client";

import { useEffect, useState } from "react";

/**
 * 추천 제품의 **검증된 공식 이미지 URL** 을 가져온다.
 *
 * ## 왜 훅으로 따로 두나
 *
 * 2026-08-04 실측 — 이미지는 처음부터 뜬 적이 없었다. 부품은 다 있었는데
 * **연결이 없었다**:
 *
 *   `catalog_product_media` 테이블 · `resolveVerifiedProductImageUrls()` ·
 *   `/api/catalog/product-images` 라우트 · 카드의 렌더 코드 — 전부 존재.
 *   **그런데 그 라우트를 부르는 곳이 하나도 없었다.**
 *
 * 랭킹 결과는 localStorage 에서 오고 거기엔 이미지가 없다. 이미지 URL 은 서명이
 * 붙어 만료되므로 **캐시에 넣으면 안 되고** 화면을 열 때마다 받아야 한다.
 * 그래서 저장 경로가 아니라 이 훅이 맡는다.
 *
 * ## 실패해도 화면을 막지 않는다
 *
 * 이미지는 부가 정보다. 못 받아도 추천 자체는 보여야 하므로 조용히 빈 맵을 준다.
 * 카드는 이미 «이미지 없음» 자리표시를 갖고 있다.
 */
const MAX_IDS = 80;

export function useProductImages(productIds: readonly (string | number)[]): {
  imageUrlById: Map<string, string>;
  loading: boolean;
} {
  const [imageUrlById, setImageUrlById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  // id 목록을 문자열로 고정해 의존성으로 쓴다 — 배열을 그대로 쓰면 매 렌더마다 새 참조가
  // 되어 요청이 반복된다.
  const key = productIds.map(String).join(",");

  useEffect(() => {
    const ids = key ? key.split(",").filter(Boolean).slice(0, MAX_IDS) : [];
    if (ids.length === 0) {
      setImageUrlById(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/catalog/product-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: ids }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { urls?: Record<string, string> };
        if (cancelled) return;
        setImageUrlById(new Map(Object.entries(json.urls ?? {})));
      } catch {
        // 이미지 실패가 추천 화면을 막지 않는다.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { imageUrlById, loading };
}
