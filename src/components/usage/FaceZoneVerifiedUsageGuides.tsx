"use client";

import { useEffect, useMemo, useState } from "react";
import ProductUsageGuide, {
  parseVerifiedUsageGuide,
  type ProductUsageGuideLocale,
} from "@/components/usage/ProductUsageGuide";
import {
  faceExplorerZoneApplicationAreas,
  usageGuideMatchesSelectedAreas,
  type FaceExplorerZone,
} from "@/lib/media/usageGuideApplicationArea";

/**
 * Lists verified LocalStorage usage guides whose applicationArea matches the zone.
 * Does not invent methods. No match → renders nothing (keeps existing zone UI).
 */
export function FaceZoneVerifiedUsageGuides({
  zone,
  locale = "ko",
}: {
  zone: FaceExplorerZone;
  locale?: ProductUsageGuideLocale;
}) {
  const applicationAreas = useMemo(
    () => faceExplorerZoneApplicationAreas(zone),
    [zone]
  );
  const [productIds, setProductIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("skinProductUsageGuides");
      const values = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(values)) {
        setProductIds([]);
        setLoaded(true);
        return;
      }
      const ids: string[] = [];
      const seen = new Set<string>();
      for (const value of values) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const productId = String((value as { productId?: unknown }).productId ?? "");
        if (!productId || seen.has(productId)) continue;
        const guide = parseVerifiedUsageGuide(value, productId);
        if (!guide) continue;
        if (
          !usageGuideMatchesSelectedAreas(guide.applicationArea, applicationAreas)
        ) {
          continue;
        }
        seen.add(productId);
        ids.push(productId);
      }
      setProductIds(ids);
    } catch {
      setProductIds([]);
    } finally {
      setLoaded(true);
    }
  }, [applicationAreas]);

  if (!loaded || productIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 border-t border-pink-100 pt-4" data-face-zone-usage={zone}>
      <p className="mb-2 text-xs font-semibold text-gray-800">검증된 사용 가이드</p>
      <div className="space-y-3">
        {productIds.map((productId) => (
          <ProductUsageGuide
            key={productId}
            productId={productId}
            locale={locale}
            emptyMode="hidden"
            applicationAreas={applicationAreas}
            className="rounded-xl border border-pink-50 bg-pink-50/40 p-3 text-xs text-gray-700"
          />
        ))}
      </div>
    </div>
  );
}
