"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

type Zone = "hair" | "forehead" | "eyebrow" | "eyes" | "cheeks" | "nose" | "lips" | "neck" | null;

const zoneInfo: Record<Exclude<Zone, null>, { tag: string; title: string; desc: string; tags: string[]; concern: string }> = {
  hair: { tag: "헤어 케어", title: "두피 & 헤어 케어", desc: "K-뷰티 헤어 케어로 건강한 두피와 윤기 있는 모발을 만들어보세요.", tags: ["샴푸", "헤어 에센스", "두피 세럼", "헤어 마스크"], concern: "Dryness" },
  forehead: { tag: "스킨케어", title: "이마 & T존 케어", desc: "T존은 피지가 많은 부위예요. 모공 케어와 수분 공급이 중요합니다.", tags: ["토너", "에센스", "모공세럼", "수분크림"], concern: "Acne" },
  eyebrow: { tag: "눈썹 메이크업", title: "눈썹 케어", desc: "자연스러운 눈썹 연출을 위한 아이브로우 제품들이에요.", tags: ["아이브로우 펜슬", "브로우 젤", "브로우 파우더", "브로우 마스카라"], concern: "Dullness" },
  eyes: { tag: "아이 메이크업", title: "눈 & 아이 케어", desc: "눈가는 피부가 얇아 전용 케어가 필요해요. 마스카라부터 아이크림까지.", tags: ["마스카라", "아이라이너", "아이섀도우", "아이크림"], concern: "Anti-aging" },
  cheeks: { tag: "치크 메이크업", title: "광대 & 치크 케어", desc: "자연스러운 혈색을 연출하는 K-뷰티 치크 제품들이에요.", tags: ["블러셔", "치크틴트", "하이라이터", "컨투어"], concern: "Dullness" },
  nose: { tag: "모공 케어", title: "코 & 모공 케어", desc: "K-뷰티의 특기인 모공 케어! BHA로 깨끗하게 관리하세요.", tags: ["BHA토너", "클렌징오일", "모공패드", "블랙헤드세럼"], concern: "Acne" },
  lips: { tag: "립 메이크업", title: "입술 & 립 케어", desc: "K-뷰티의 상징 립 틴트! 촉촉하고 선명한 입술을 연출하세요.", tags: ["립틴트", "립스틱", "립글로스", "립밤"], concern: "Dryness" },
  neck: { tag: "넥 케어", title: "목 & 넥 케어", desc: "목도 얼굴만큼 중요해요. 탄력과 보습으로 관리하세요.", tags: ["넥크림", "보습크림", "탄력세럼", "선크림"], concern: "Anti-aging" },
};

export default function FaceExplorer() {
  const [gender, setGender] = useState<"female" | "male">("female");
  const [activeZone, setActiveZone] = useState<Zone>(null);
  const info = activeZone ? zoneInfo[activeZone] : null;

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-sans">
      <header className="flex items-center justify-between px-8 py-6">
        <span className="text-sm font-semibold tracking-[0.2em] text-[#B8860B]">K-BEAUTY GUIDE</span>
        <Link href="/" className="text-sm text-[#C2185B]">← Home</Link>
      </header>
      <main className="max-w-5xl mx-auto px-6 pb-16">
        <h1 className="text-4xl font-bold mb-2">얼굴로 탐색하기</h1>
        <p className="text-gray-500 mb-8">얼굴 부위를 선택하면 관련 K-뷰티 정보와 제품 카테고리를 정리해드립니다.</p>
        <div className="flex gap-8 items-start">
          <div className="flex-1 bg-white rounded-3xl border border-pink-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">얼굴 부위를 클릭해보세요.</span>
              <div className="flex gap-2">
                {(["female", "male"] as const).map((g) => (
                  <button key={g} onClick={() => { setGender(g); setActiveZone(null); }}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${gender === g ? "bg-[#C2185B] text-white" : "border border-pink-200 text-gray-600 hover:bg-pink-50"}`}>
                    {g === "female" ? "여성" : "남성"}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative mx-auto" style={{ maxWidth: 480 }}>
              <Image
                src={gender === "female" ? "/face-female.png" : "/face-male.png"}
                alt="얼굴" width={480} height={580} className="w-full"
              />
              <svg
                viewBox="0 0 480 580"
                className="absolute inset-0 w-full h-full"
                style={{ top: 0, left: 0 }}
              >
                {/* 머리카락 */}
                <ellipse cx="240" cy="60" rx="130" ry="55"
                  fill={activeZone === "hair" ? "rgba(194,24,91,0.18)" : "transparent"}
                  stroke={activeZone === "hair" ? "rgba(194,24,91,0.5)" : "transparent"}
                  strokeWidth="2" className="cursor-pointer"
                  onClick={() => setActiveZone("hair")}
                  onMouseEnter={e => (e.currentTarget.style.fill = "rgba(194,24,91,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.fill = activeZone === "hair" ? "rgba(194,24,91,0.18)" : "transparent")}
                />
                {/* 이마 */}
                <ellipse cx="240" cy="135" rx="100" ry="40"
                  fill={activeZone === "forehead" ? "rgba(194,24,91,0.18)" : "transparent"}
                  stroke={activeZone === "forehead" ? "rgba(194,24,91,0.5)" : "transparent"}
                  strokeWidth="2" className="cursor-pointer"
                  onClick={() => setActiveZone("forehead")}
                  onMouseEnter={e => (e.currentTarget.style.fill = "rgba(194,24,91,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.fill = activeZone === "forehead" ? "rgba(194,24,91,0.18)" : "transparent")}
                />
                {/* 눈썹 */}
                <rect x="115" y="178" width="250" height="32" rx="10"
                  fill={activeZone === "eyebrow" ? "rgba(194,24,91,0.18)" : "transparent"}
                  stroke={activeZone === "eyebrow" ? "rgba(194,24,91,0.5)" : "transparent"}
                  strokeWidth="2" className="cursor-pointer"
                  onClick={() => setActiveZone("eyebrow")}
                  onMouseEnter={e => (e.currentTarget.style.fill = "rgba(194,24,91,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.fill = activeZone === "eyebrow" ? "rgba(194,24,91,0.18)" : "transparent")}
                />
                {/* 눈 */}
                <rect x="110" y="210" width="260" height="40" rx="10"
                  fill={activeZone === "eyes" ? "rgba(194,24,91,0.18)" : "transparent"}
                  stroke={activeZone === "eyes" ? "rgba(194,24,91,0.5)" : "transparent"}
                  strokeWidth="2" className="cursor-pointer"
                  onClick={() => setActiveZone("eyes")}
                  onMouseEnter={e => (e.currentTarget.style.fill = "rgba(194,24,91,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.fill = activeZone === "eyes" ? "rgba(194,24,91,0.18)" : "transparent")}
                />
                {/* 왼쪽 광대 */}
                <ellipse cx="145" cy="290" rx="60" ry="45"
                  fill={activeZone === "cheeks" ? "rgba(194,24,91,0.18)" : "transparent"}
                  stroke={activeZone === "cheeks" ? "rgba(194,24,91,0.5)" : "transparent"}
                  strokeWidth="2" className="cursor-pointer"
                  onClick={() => setActiveZone("cheeks")}
                  onMouseEnter={e => (e.currentTarget.style.fill = "rgba(194,24,91,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.fill = activeZone === "cheeks" ? "rgba(194,24,91,0.18)" : "transparent")}
                />
                {/* 오른쪽 광대 */}
                <ellipse cx="335" cy="290" rx="60" ry="45"
                  fill={activeZone === "cheeks" ? "rgba(194,24,91,0.18)" : "transparent"}
                  stroke={activeZone === "cheeks" ? "rgba(194,24,91,0.5)" : "transparent"}
                  strokeWidth="2" className="cursor-pointer"
                  onClick={() => setActiveZone("cheeks")}
                  onMouseEnter={e => (e.currentTarget.style.fill = "rgba(194,24,91,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.fill = activeZone === "cheeks" ? "rgba(194,24,91,0.18)" : "transparent")}
                />
                {/* 코 */}
                <ellipse cx="240" cy="295" rx="38" ry="48"
                  fill={activeZone === "nose" ? "rgba(194,24,91,0.18)" : "transparent"}
                  stroke={activeZone === "nose" ? "rgba(194,24,91,0.5)" : "transparent"}
                  strokeWidth="2" className="cursor-pointer"
                  onClick={() => setActiveZone("nose")}
                  onMouseEnter={e => (e.currentTarget.style.fill = "rgba(194,24,91,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.fill = activeZone === "nose" ? "rgba(194,24,91,0.18)" : "transparent")}
                />
                {/* 입술 */}
                <ellipse cx="240" cy="368" rx="60" ry="28"
                  fill={activeZone === "lips" ? "rgba(194,24,91,0.18)" : "transparent"}
                  stroke={activeZone === "lips" ? "rgba(194,24,91,0.5)" : "transparent"}
                  strokeWidth="2" className="cursor-pointer"
                  onClick={() => setActiveZone("lips")}
                  onMouseEnter={e => (e.currentTarget.style.fill = "rgba(194,24,91,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.fill = activeZone === "lips" ? "rgba(194,24,91,0.18)" : "transparent")}
                />
                {/* 목 */}
                <ellipse cx="240" cy="490" rx="55" ry="50"
                  fill={activeZone === "neck" ? "rgba(194,24,91,0.18)" : "transparent"}
                  stroke={activeZone === "neck" ? "rgba(194,24,91,0.5)" : "transparent"}
                  strokeWidth="2" className="cursor-pointer"
                  onClick={() => setActiveZone("neck")}
                  onMouseEnter={e => (e.currentTarget.style.fill = "rgba(194,24,91,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.fill = activeZone === "neck" ? "rgba(194,24,91,0.18)" : "transparent")}
                />
              </svg>
            </div>
          </div>
          <div className="w-80 bg-white rounded-3xl border border-pink-100 p-6 shadow-sm min-h-[420px]">
            {info ? (
              <>
                <p className="text-xs font-semibold tracking-widest text-[#B8860B] mb-4">선택한 부위 가이드</p>
                <span className="inline-block bg-pink-100 text-[#C2185B] text-xs font-medium px-3 py-1 rounded-full mb-3">{info.tag}</span>
                <h2 className="text-2xl font-bold mb-3">{info.title}</h2>
                <p className="text-sm text-gray-500 mb-4">{info.desc}</p>
                <p className="text-xs text-gray-400 mb-2">관련 제품 태그</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {info.tags.map(t => (
                    <span key={t} className="border border-pink-200 text-[#C2185B] text-xs px-3 py-1 rounded-full">{t}</span>
                  ))}
                </div>
                <Link href={`/results?concern=${info.concern}`}>
                  <button className="w-full bg-[#C2185B] text-white rounded-full py-3 text-sm font-semibold hover:bg-[#a3154f] transition">관련 제품 보기</button>
                </Link>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3 py-20">
                <span className="text-4xl">👆</span>
                <p className="text-sm">얼굴의 부위를 클릭하면<br/>K-뷰티 제품 정보가 나와요</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

