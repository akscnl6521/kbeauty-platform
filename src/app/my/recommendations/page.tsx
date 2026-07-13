"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadCareStore, type CareStoreSnapshot } from "@/lib/care";
import { MyCareNav } from "../MyCareNav";

export default function MyRecommendationsPage() {
  const [store, setStore] = useState<CareStoreSnapshot | null>(null);
  useEffect(() => setStore(loadCareStore()), []);
  const session = store?.sessions[0];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">최근 추천</h1>
      <MyCareNav current="/my/recommendations" />
      <p className="mt-2 text-sm text-gray-600">
        당시 snapshot 기준입니다. 카탈로그가 바뀌어도 당시 결과를 보존합니다.
      </p>
      {session ? (
        <div className="mt-4 rounded-lg border border-[#E8DFD8] bg-white px-3 py-3 text-sm">
          <p>제품 ID: {session.rankedProductIds.join(", ") || "—"}</p>
          <p className="mt-2 text-xs text-gray-500">
            confidence {session.dataConfidence ?? "—"}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm">
          <Link href="/analyze" className="text-[#8B6914] underline">
            분석하기
          </Link>
        </p>
      )}
    </main>
  );
}
