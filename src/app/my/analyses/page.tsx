"use client";

import { useEffect, useState } from "react";
import { loadCareStore, type CareStoreSnapshot } from "@/lib/care";
import { MyCareNav } from "../MyCareNav";

export default function MyAnalysesPage() {
  const [store, setStore] = useState<CareStoreSnapshot | null>(null);
  useEffect(() => setStore(loadCareStore()), []);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">분석 기록</h1>
      <MyCareNav current="/my/analyses" />
      <ul className="mt-6 space-y-2 text-sm">
        {(store?.sessions ?? []).map((s) => (
          <li
            key={s.id}
            className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
          >
            <p className="font-medium tabular-nums">{s.createdAt}</p>
            <p className="text-gray-600">
              고민 {(s.concerns ?? []).join(", ") || "—"} · 제품{" "}
              {s.rankedProductIds.length}개
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
