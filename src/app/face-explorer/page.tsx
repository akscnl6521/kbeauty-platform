 "use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useLocale } from "@/hooks/useLocale";

type Zone = "forehead" | "eyes" | "cheeks" | "nose" | "lips" | "chin" | null;

const zoneInfo = {
  forehead: { tag: "스킨케어", title: "이마 & T존 케어", desc: "T존은 피지가 많은 부위예요. 모공 케어와 수분 공급이 중요합니다.", tags: ["토너", "에센스", "모공세럼", "수분크림"], concern: "Acne" },
  eyes: { tag: "아이 메이크업", title: "눈 & 아이 케어", desc: "눈가는 피부가 얇아 전용 케어가 필요해요. 마스카라부터 아이크림까지.", tags: ["마스카라", "아이라이너", "아이섀도우", "아이크림"], concern: "Anti-aging" },
  cheeks: { tag: "치크 메이크업", title: "볼 & 치크 케어", desc: "자연스러운 혈색을 연출하는 K-뷰티 치크 제품들이에요.", tags: ["블러셔", "치크틴트", "하이라이터", "컨투어"], concern: "Dullness" },
  nose: { tag: "모공 케어", title: "코 & 모공 케어", desc: "K-뷰티의 특기인 모공 케어! BHA로 깨끗하게 관리하세요.", tags: ["BHA토너", "클렌징오일", "모공패드", "블랙헤드세럼"], concern: "Acne" },
  lips: { tag: "립 메이크업", title: "입술 & 립 케어", desc: "K-뷰티의 상징 립 틴트! 촉촉하고 선명한 입술을 연출하세요.", tags: ["립틴트", "립스틱", "립글로스", "립밤"], concern: "Dryness" },
  chin: { tag: "윤곽 케어", title: "턱선 & 리프팅", desc: "페이스 라인을 살리는 컨투어링과 리프팅 케어예요.", tags: ["리프팅크림", "페이스마스크", "탄력세럼", "컨투어"], concern: "Anti-aging" },
};

export default function FaceExplorer() {
  const { locale } = useLocale();
  const [gender, setGender] = useState<"female" | "male">("female");
  const [activeZone, setActiveZone] = useState<Zone>(null);

  const info = activeZone ? zoneInfo[activeZone] : null;

  const zones = [
    { id: "forehead", top: "8%", left: "32%", width: "36%", height: "11%" },
    { id: "eyes", top: "24%", left: "20%", width: "60%", height: "10%" },
    { id: "cheeks", top: "36%", left: "10%", width: "32%", height: "14%" },
    { id: "cheeks", top: "36%", left: "58%", width: "32%", height: "14%" },
    { id: "nose", top: "36%", left: "40%", width: "20%", height: "16%" },
    { id: "lips", top: "55%", left: "31%", width: "38%", height: "9%" },
    { id: "chin", top: "64%", left: "27%", width: "46%", height: "10%" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-sans">
      <header className="flex items-center justify-between px-8 py-6">
        <span className="text-sm font-semibold tracking-[0.2em] text-[#B8860B]">K-BEAUTY GUIDE</span>
        <Link href="/" className="text-sm text-[#C2185B]">← Home</Link>
      </header>
      <main className="max-w-5xl mx-auto px-6 pb-16">
        <h1 className="text-4xl font-bold mb-2">얼굴로 탐색하기</h1>
        <p className="text-gray-500 mb-10">얼굴 부위를 선택하면 관련 K-뷰티 정보와 제품 카테고리를 정리해드립니다.</p>
        <div className="flex gap-8 items-start">
          <div className="flex-1 bg-white rounded-3xl border border-pink-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">얼굴 부위를 클릭해보세요.</span>
              <div className="flex gap-2">
                {(["female", "male"] as const).map((g) => (
                  <button key={g} onClick={() => setGender(g)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${gender === g ? "bg-[#C2185B] text-white" : "border border-pink-200 text-gray-600 hover:bg-pink-50"}`}>
                    {g === "female" ? "여성" : "남성"}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative" style={{ maxWidth: 520, margin: "0 auto", overflow: "visible" }}>
              <Image
                src={gender === "female" ? "/face-female.png" : "/face-male.png"}
                alt="얼굴"
                width={520}
                height={650}
                className="w-full"
              />
              {zones.map((z, idx) => (
                <button key={`${z.id}-${idx}`} onClick={() => setActiveZone(z.id as Zone)}
                  style={{ position: "absolute", top: z.top, left: z.left, width: z.width, height: z.height, background: activeZone === z.id ? "rgba(194,24,91,0.2)" : "transparent", border: activeZone === z.id ? "2px solid rgba(194,24,91,0.5)" : "none", borderRadius: 8, cursor: "pointer", transition: "background .2s, border .2s" }}
                  onMouseEnter={e => { if (activeZone !== z.id) (e.target as HTMLElement).style.background = "rgba(194,24,91,0.1)"; }}
                  onMouseLeave={e => { if (activeZone !== z.id) (e.target as HTMLElement).style.background = "transparent"; }}
                />
              ))}
            </div>
          </div>
          <div className="w-80 bg-white rounded-3xl border border-pink-100 p-6 shadow-sm min-h-[400px]">
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

