"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type IngredientListItem = {
  slug: string;
  name_en: string;
  name_ko: string | null;
};

const FALLBACK: IngredientListItem[] = [
  { slug: "niacinamide", name_en: "Niacinamide", name_ko: "나이아신아마이드" },
  { slug: "ceramide", name_en: "Ceramide", name_ko: "세라마이드" },
  {
    slug: "hyaluronic-acid",
    name_en: "Hyaluronic Acid",
    name_ko: "히알루론산",
  },
];

function displayName(row: IngredientListItem): string {
  const ko = row.name_ko?.trim();
  if (ko) return ko;
  return row.name_en?.trim() || row.slug;
}

export default function IngredientsPage() {
  const [items, setItems] = useState<IngredientListItem[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [fromDb, setFromDb] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("ingredients")
          .select("slug, name_en, name_ko")
          .not("slug", "is", null)
          .order("name_en", { ascending: true })
          .limit(60);

        if (error) {
          console.error("[ingredients list]", error);
          return;
        }

        const rows = ((data as IngredientListItem[]) ?? []).filter(
          (r) => typeof r.slug === "string" && r.slug.trim()
        );
        if (!cancelled && rows.length > 0) {
          setItems(rows);
          setFromDb(true);
        }
      } catch (e) {
        console.error("[ingredients list]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto min-h-[60vh] max-w-4xl px-5 py-14">
      <p className="text-sm font-semibold text-[#C2185B]">성분 가이드</p>
      <h1 className="mt-3 text-3xl font-bold">성분 정보를 차분히 확인하세요</h1>
      <p className="mt-4 max-w-2xl text-gray-600">
        공개된 성분 설명·주의·참고 문헌을 모았습니다. 제품의 최신 전성분과 사용
        조건은 구매 전 공식 페이지에서 다시 확인해 주세요. 의료 진단이 아닙니다.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/quiz"
          className="touch-target inline-flex items-center justify-center rounded-full bg-[#C2185B] px-4 py-2.5 text-sm font-semibold text-white"
        >
          피부 문진으로 추천 받기
        </Link>
        <Link
          href="/results"
          className="touch-target inline-flex items-center justify-center rounded-full border border-pink-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
        >
          추천 결과 보기
        </Link>
        <Link
          href="/analyze"
          className="touch-target inline-flex items-center justify-center rounded-full border border-[#E8DFD8] bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
        >
          피부 분석
        </Link>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-gray-500">성분 목록을 불러오는 중…</p>
      ) : (
        <>
          <p className="mt-8 text-xs text-gray-500">
            {fromDb
              ? `${items.length}개 성분 (검수·등록 데이터)`
              : "기본 안내 성분 (연결 DB 목록이 비어 있어 예시 3개를 표시)"}
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {items.map((row) => (
              <li key={row.slug}>
                <Link
                  href={`/ingredients/${row.slug}`}
                  className="touch-target flex min-h-[4.5rem] flex-col justify-center rounded-xl border border-pink-100 bg-white p-5 font-medium transition hover:border-[#C2185B]"
                >
                  {displayName(row)}
                  <span className="mt-1 block text-xs font-normal text-gray-500">
                    {row.name_en}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
