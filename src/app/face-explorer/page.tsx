"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useLocale } from "@/hooks/useLocale";

type Locale = "en" | "ja" | "ko";
type Gender = "female" | "male";
type FaceArea = "forehead" | "eyes" | "cheeks" | "nose" | "lips" | "chin";

type AreaInfo = {
  tag: string;
  title: string;
  productTags: string[];
};

const UI_TEXT: Record<
  Locale,
  {
    pageTitle: string;
    pageDesc: string;
    female: string;
    male: string;
    pickHint: string;
    relatedButton: string;
    areaLabel: Record<FaceArea, string>;
    infoTitle: string;
  }
> = {
  ko: {
    pageTitle: "얼굴로 탐색하기",
    pageDesc: "얼굴 부위를 선택하면 관련 K-뷰티 정보와 제품 카테고리를 정리해드립니다.",
    female: "여성",
    male: "남성",
    pickHint: "얼굴 부위를 클릭해보세요.",
    relatedButton: "관련 제품 보기",
    infoTitle: "선택한 부위 가이드",
    areaLabel: {
      forehead: "이마",
      eyes: "눈",
      cheeks: "볼",
      nose: "코",
      lips: "입술",
      chin: "턱/윤곽",
    },
  },
  en: {
    pageTitle: "Face Explorer",
    pageDesc: "Tap a face area to explore related K-beauty guide topics and product categories.",
    female: "Female",
    male: "Male",
    pickHint: "Click a face area to begin.",
    relatedButton: "View Related Products",
    infoTitle: "Area Guide",
    areaLabel: {
      forehead: "Forehead",
      eyes: "Eyes",
      cheeks: "Cheeks",
      nose: "Nose",
      lips: "Lips",
      chin: "Chin / Jawline",
    },
  },
  ja: {
    pageTitle: "顔で探す",
    pageDesc: "顔の部位を選ぶと、関連するK-ビューティー情報と製品カテゴリを整理します。",
    female: "女性",
    male: "男性",
    pickHint: "気になる部位をクリックしてください。",
    relatedButton: "関連製品を見る",
    infoTitle: "部位ガイド",
    areaLabel: {
      forehead: "額",
      eyes: "目",
      cheeks: "頬",
      nose: "鼻",
      lips: "唇",
      chin: "顎 / フェイスライン",
    },
  },
};

const AREA_INFO: Record<Locale, Record<FaceArea, AreaInfo>> = {
  ko: {
    forehead: {
      tag: "스킨케어",
      title: "이마 & T존 케어",
      productTags: ["토너", "에센스", "모공세럼", "수분크림"],
    },
    eyes: {
      tag: "아이 메이크업",
      title: "눈 & 아이 케어",
      productTags: ["마스카라", "아이라이너", "아이섀도우", "아이크림"],
    },
    cheeks: {
      tag: "치크 메이크업",
      title: "볼 & 치크 케어",
      productTags: ["블러셔", "치크틴트", "하이라이터", "컨투어"],
    },
    nose: {
      tag: "모공 케어",
      title: "코 & 모공 케어",
      productTags: ["BHA토너", "클렌징오일", "모공패드", "블랙헤드세럼"],
    },
    lips: {
      tag: "립 메이크업",
      title: "입술 & 립 케어",
      productTags: ["립틴트", "립스틱", "립글로스", "립밤"],
    },
    chin: {
      tag: "윤곽 케어",
      title: "턱선 & 리프팅",
      productTags: ["리프팅크림", "페이스마스크", "탄력세럼", "컨투어"],
    },
  },
  en: {
    forehead: {
      tag: "Skincare",
      title: "Forehead & T-zone Care",
      productTags: ["Toner", "Essence", "Pore Serum", "Moisturizer"],
    },
    eyes: {
      tag: "Eye Makeup",
      title: "Eyes & Eye Care",
      productTags: ["Mascara", "Eyeliner", "Eyeshadow", "Eye Cream"],
    },
    cheeks: {
      tag: "Cheek Makeup",
      title: "Cheeks & Blush Care",
      productTags: ["Blusher", "Cheek Tint", "Highlighter", "Contour"],
    },
    nose: {
      tag: "Pore Care",
      title: "Nose & Pore Care",
      productTags: ["BHA Toner", "Cleansing Oil", "Pore Pad", "Blackhead Serum"],
    },
    lips: {
      tag: "Lip Makeup",
      title: "Lips & Lip Care",
      productTags: ["Lip Tint", "Lipstick", "Lip Gloss", "Lip Balm"],
    },
    chin: {
      tag: "Contour Care",
      title: "Jawline & Lifting",
      productTags: ["Lifting Cream", "Face Mask", "Firming Serum", "Contour"],
    },
  },
  ja: {
    forehead: {
      tag: "スキンケア",
      title: "額 & Tゾーンケア",
      productTags: ["トナー", "エッセンス", "毛穴セラム", "保湿クリーム"],
    },
    eyes: {
      tag: "アイメイク",
      title: "目 & アイケア",
      productTags: ["マスカラ", "アイライナー", "アイシャドウ", "アイクリーム"],
    },
    cheeks: {
      tag: "チークメイク",
      title: "頬 & チークケア",
      productTags: ["ブラッシャー", "チークティント", "ハイライター", "コントゥア"],
    },
    nose: {
      tag: "毛穴ケア",
      title: "鼻 & 毛穴ケア",
      productTags: ["BHAトナー", "クレンジングオイル", "毛穴パッド", "ブラックヘッドセラム"],
    },
    lips: {
      tag: "リップメイク",
      title: "唇 & リップケア",
      productTags: ["リップティント", "リップスティック", "リップグロス", "リップバーム"],
    },
    chin: {
      tag: "輪郭ケア",
      title: "フェイスライン & リフティング",
      productTags: ["リフティングクリーム", "フェイスマスク", "弾力セラム", "コントゥア"],
    },
  },
};

function areaHitboxClass(area: FaceArea): string {
  // Percent-based positions requested by user
  switch (area) {
    case "forehead":
      return "top-[12%] left-[30%] w-[40%] h-[10%]";
    case "eyes":
      return "top-[28%] left-[15%] w-[70%] h-[12%]";
    case "cheeks":
      return "top-[42%] left-[8%] w-[84%] h-[12%]";
    case "nose":
      return "top-[46%] left-[36%] w-[28%] h-[12%]";
    case "lips":
      return "top-[58%] left-[28%] w-[44%] h-[10%]";
    case "chin":
      return "top-[68%] left-[22%] w-[56%] h-[10%]";
  }
}

export default function FaceExplorerPage() {
  const { locale: rawLocale } = useLocale();
  const locale = rawLocale as Locale;

  const [gender, setGender] = useState<Gender>("female");
  const [selectedArea, setSelectedArea] = useState<FaceArea>("forehead");

  const t = UI_TEXT[locale] ?? UI_TEXT.en;
  const infoMap = AREA_INFO[locale] ?? AREA_INFO.en;
  const selectedInfo = infoMap[selectedArea];

  const imageSrc = useMemo(() => {
    return gender === "female" ? "/face-female.png" : "/face-male.png";
  }, [gender]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#C2185B]">
              K-Beauty Guide
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              {t.pageTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
              {t.pageDesc}
            </p>
          </div>

          <Link
            href="/"
            className="mt-1 text-xs font-semibold text-[#C2185B] underline hover:no-underline"
          >
            ← Home
          </Link>
        </header>

        <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Left: Image explorer */}
          <div className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{t.pickHint}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGender("female")}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    gender === "female"
                      ? "bg-[#C2185B] text-white"
                      : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
                  }`}
                >
                  {t.female}
                </button>
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    gender === "male"
                      ? "bg-[#C2185B] text-white"
                      : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
                  }`}
                >
                  {t.male}
                </button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[400px] min-h-[500px]">
              <Image
                src={imageSrc}
                alt={gender === "female" ? "female face" : "male face"}
                fill
                sizes="(min-width: 768px) 400px, 100vw"
                className="select-none rounded-2xl object-contain"
                priority
              />

              {/* Transparent clickable areas */}
              {(
                ["forehead", "eyes", "cheeks", "nose", "lips", "chin"] as FaceArea[]
              ).map((area) => {
                const active = selectedArea === area;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedArea(area)}
                    className={[
                      "absolute rounded-2xl",
                      areaHitboxClass(area),
                      "bg-transparent",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                      "hover:bg-[rgba(194,24,91,0.15)]",
                      active ? "ring-2 ring-[#C2185B]/60" : "",
                    ].join(" ")}
                    aria-label={t.areaLabel[area]}
                    title={t.areaLabel[area]}
                  />
                );
              })}
            </div>
          </div>

          {/* Right: Info card */}
          <aside className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#B8860B]">
              {t.infoTitle}
            </p>
            <div className="mt-4">
              <span className="inline-flex rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-[#C2185B]">
                {selectedInfo.tag}
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">
                {selectedInfo.title}
              </h2>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                {locale === "ko"
                  ? "관련 제품 태그"
                  : locale === "ja"
                    ? "関連カテゴリ"
                    : "Related Tags"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedInfo.productTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-full border border-pink-200 bg-white px-3 py-1 text-xs font-medium text-gray-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <Link href="/results">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#C2185B] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a3154f]"
                >
                  {t.relatedButton}
                </button>
              </Link>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

