"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

type Zone = "hair" | "forehead" | "eyebrow" | "eyes" | "cheeks" | "nose" | "lips" | "neck" | null;

const zoneInfo: Record<Exclude<Zone, null>, {
  tag: string; title: string; desc: string; tags: string[]; concern: string; color: string;
}> = {
  hair:     { tag: "헤어 케어",     title: "두피 & 헤어 케어",  desc: "건강한 두피와 윤기 있는 모발을 위한 K-뷰티 헤어 케어예요.",          tags: ["샴푸", "헤어 에센스", "두피 세럼", "헤어 마스크"],                concern: "Dryness",    color: "#7C5CBF" },
  forehead: { tag: "스킨케어",      title: "이마 & T존 케어",   desc: "T존은 피지가 많은 부위예요. 모공 케어와 수분 공급이 중요합니다.",       tags: ["토너", "에센스", "모공세럼", "수분크림"],                          concern: "Acne",       color: "#C2185B" },
  eyebrow:  { tag: "눈썹 메이크업", title: "눈썹 케어",         desc: "자연스러운 눈썹 연출을 위한 아이브로우 제품들이에요.",                 tags: ["아이브로우 펜슬", "브로우 젤", "브로우 파우더", "브로우 마스카라"], concern: "Dullness",   color: "#8B6914" },
  eyes:     { tag: "아이 메이크업", title: "눈 & 아이 케어",    desc: "눈가 피부는 얇고 예민해서 전용 케어가 필요해요.",                     tags: ["마스카라", "아이라이너", "아이섀도우", "아이크림"],                concern: "Anti-aging", color: "#1565C0" },
  cheeks:   { tag: "치크 메이크업", title: "광대 & 치크 케어",  desc: "자연스러운 혈색을 연출하는 K-뷰티 치크 제품들이에요.",                tags: ["블러셔", "치크틴트", "하이라이터", "컨투어"],                     concern: "Dullness",   color: "#D84884" },
  nose:     { tag: "모공 케어",     title: "코 & 모공 케어",    desc: "K-뷰티의 특기인 모공 케어! BHA 성분으로 깨끗하게 관리하세요.",         tags: ["BHA토너", "클렌징오일", "모공패드", "블랙헤드세럼"],               concern: "Acne",       color: "#2E7D32" },
  lips:     { tag: "립 메이크업",   title: "입술 & 립 케어",   desc: "K-뷰티의 상징 립 틴트! 촉촉하고 선명한 입술을 연출하세요.",           tags: ["립틴트", "립스틱", "립글로스", "립밤"],                           concern: "Dryness",    color: "#C2185B" },
  neck:     { tag: "넥 케어",      title: "목 & 넥 케어",      desc: "목도 얼굴만큼 중요해요. 탄력과 보습으로 꾸준히 관리하세요.",           tags: ["넥크림", "보습크림", "탄력세럼", "선크림"],                       concern: "Anti-aging", color: "#00838F" },
};

const zoneLabels: Record<Exclude<Zone, null>, string> = {
  hair: "머리", forehead: "이마", eyebrow: "눈썹", eyes: "눈",
  cheeks: "광대", nose: "코", lips: "입술", neck: "목",
};

const femaleZones: { id: Exclude<Zone, null>; cx: number; cy: number; rx: number; ry: number; lx: number; ly: number; side: "left" | "right" }[] = [
  { id: "hair",     cx: 256, cy: 68,  rx: 120, ry: 52,  lx: 430, ly: 48,  side: "right" },
  { id: "forehead", cx: 256, cy: 138, rx: 95,  ry: 38,  lx: 430, ly: 120, side: "right" },
  { id: "eyebrow",  cx: 256, cy: 183, rx: 110, ry: 18,  lx: 60,  ly: 175, side: "left"  },
  { id: "eyes",     cx: 256, cy: 215, rx: 115, ry: 22,  lx: 430, ly: 210, side: "right" },
  { id: "cheeks",   cx: 185, cy: 285, rx: 58,  ry: 42,  lx: 60,  ly: 285, side: "left"  },
  { id: "nose",     cx: 256, cy: 288, rx: 32,  ry: 48,  lx: 430, ly: 288, side: "right" },
  { id: "lips",     cx: 256, cy: 362, rx: 58,  ry: 26,  lx: 60,  ly: 355, side: "left"  },
  { id: "neck",     cx: 256, cy: 480, rx: 52,  ry: 45,  lx: 430, ly: 475, side: "right" },
];

const maleZones: { id: Exclude<Zone, null>; cx: number; cy: number; rx: number; ry: number; lx: number; ly: number; side: "left" | "right" }[] = [
  { id: "hair",     cx: 256, cy: 62,  rx: 122, ry: 52,  lx: 430, ly: 45,  side: "right" },
  { id: "forehead", cx: 256, cy: 135, rx: 100, ry: 40,  lx: 430, ly: 118, side: "right" },
  { id: "eyebrow",  cx: 256, cy: 182, rx: 115, ry: 20,  lx: 60,  ly: 174, side: "left"  },
  { id: "eyes",     cx: 256, cy: 215, rx: 118, ry: 22,  lx: 430, ly: 210, side: "right" },
  { id: "cheeks",   cx: 185, cy: 288, rx: 60,  ry: 44,  lx: 60,  ly: 288, side: "left"  },
  { id: "nose",     cx: 256, cy: 292, rx: 33,  ry: 50,  lx: 430, ly: 292, side: "right" },
  { id: "lips",     cx: 256, cy: 365, rx: 55,  ry: 24,  lx: 60,  ly: 358, side: "left"  },
  { id: "neck",     cx: 256, cy: 482, rx: 54,  ry: 46,  lx: 430, ly: 478, side: "right" },
];

export default function FaceExplorer() {
  const [gender, setGender] = useState<"female" | "male">("female");
  const [hoverZone, setHoverZone] = useState<Zone>(null);
  const [activeZone, setActiveZone] = useState<Zone>(null);

  const displayZone = hoverZone || activeZone;
  const info = displayZone ? zoneInfo[displayZone] : null;
  const zones = gender === "female" ? femaleZones : maleZones;

  return (
    <div className="min-h-screen font-sans" style={{ backgroundImage: "url('/face-bg.png')", backgroundSize: "cover", backgroundPosition: "center top", backgroundRepeat: "no-repeat", backgroundAttachment: "fixed" }}>
      <header className="flex items-center justify-between px-8 py-5 border-b border-pink-50">
        <span className="text-sm font-semibold tracking-[0.2em] text-[#B8860B]">K-BEAUTY GUIDE</span>
        <Link href="/" className="text-sm text-[#C2185B] hover:underline">← Home</Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">얼굴로 탐색하기</h1>
          <p className="text-gray-500">부위에 마우스를 올리면 관련 K-뷰티 정보를 확인할 수 있어요.</p>
        </div>

        <div className="flex gap-8 items-start">
          {/* 왼쪽: 얼굴 이미지 */}
          <div className="flex-1 bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="relative" style={{ paddingBottom: "109%" }}>
              <div className="absolute inset-0">
                <Image
                  src={gender === "female" ? "/face-female.png" : "/face-male.png"}
                  alt="얼굴"
                  fill
                  className="object-cover object-top"
                />
              </div>

              {/* SVG 레이어 - 기본은 완전 투명, 호버시만 표시 */}
              <svg
                viewBox="0 0 512 559"
                className="absolute inset-0 w-full h-full"
              >
                {zones.map((z) => {
                  const isHovered = displayZone === z.id;
                  const color = zoneInfo[z.id].color;
                  const ex = z.side === "right" ? z.cx + z.rx : z.cx - z.rx;
                  const ey = z.cy;

                  return (
                    <g key={z.id} style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoverZone(z.id)}
                      onMouseLeave={() => setHoverZone(null)}
                      onClick={() => setActiveZone(activeZone === z.id ? null : z.id)}
                    >
                      {/* 투명한 히트 영역 - 항상 클릭/호버 가능 */}
                      <ellipse
                        cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry}
                        fill="transparent"
                        stroke="transparent"
                        strokeWidth="0"
                      />

                      {/* 호버/선택 시에만 보이는 요소들 */}
                      {isHovered && (
                        <>
                          {/* 존 하이라이트 타원 */}
                          <ellipse
                            cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry}
                            fill={`${color}30`}
                            stroke={color}
                            strokeWidth="2"
                          />
                          {/* 연결선 */}
                          <line
                            x1={ex} y1={ey}
                            x2={z.lx} y2={z.ly}
                            stroke={color}
                            strokeWidth="1.5"
                          />
                          {/* 작은 점 (존 끝) */}
                          <circle cx={ex} cy={ey} r="3" fill={color} />
                          {/* 라벨 배경 */}
                          <rect
                            x={z.side === "right" ? z.lx + 4 : z.lx - 80}
                            y={z.ly - 14}
                            width={76} height={26} rx={13}
                            fill={color}
                          />
                          {/* 라벨 텍스트 */}
                          <text
                            x={z.side === "right" ? z.lx + 42 : z.lx - 42}
                            y={z.ly + 4}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="700"
                            fill="white"
                            style={{ fontFamily: "sans-serif", pointerEvents: "none" }}
                          >
                            {zoneLabels[z.id]}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* 하단 버튼 바 */}
            <div className="px-6 py-4 bg-pink-50 border-t border-pink-100">
              <div className="flex flex-wrap gap-2 justify-center">
                {(Object.keys(zoneLabels) as Exclude<Zone, null>[]).map((id) => (
                  <button key={id}
                    onMouseEnter={() => setHoverZone(id)}
                    onMouseLeave={() => setHoverZone(null)}
                    onClick={() => setActiveZone(activeZone === id ? null : id)}
                    className="text-xs px-3 py-1.5 rounded-full border transition-all font-medium"
                    style={{
                      borderColor: displayZone === id ? zoneInfo[id].color : "#FFCCD9",
                      color: displayZone === id ? "white" : "#9ca3af",
                      background: displayZone === id ? zoneInfo[id].color : "white",
                    }}>
                    {zoneLabels[id]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 오른쪽: 정보 카드 */}
          <div className="w-72 flex flex-col gap-4">
            {/* 성별 토글 */}
            <div className="bg-white rounded-2xl border border-pink-100 p-4 shadow-sm flex gap-2">
              {(["female", "male"] as const).map((g) => (
                <button key={g}
                  onClick={() => { setGender(g); setHoverZone(null); setActiveZone(null); }}
                  className="flex-1 py-2 rounded-xl text-sm font-medium transition"
                  style={{
                    background: gender === g ? "#C2185B" : "transparent",
                    color: gender === g ? "white" : "#9ca3af",
                    border: gender === g ? "none" : "1.5px solid #FFCCD9",
                  }}>
                  {g === "female" ? "여성" : "남성"}
                </button>
              ))}
            </div>

            {/* 정보 카드 */}
            <div className="bg-white rounded-3xl border border-pink-100 p-6 shadow-sm min-h-[380px] flex flex-col justify-center">
              {info ? (
                <div>
                  <p className="text-xs font-semibold tracking-widest text-[#B8860B] mb-4 uppercase">부위 가이드</p>
                  <span className="inline-block text-white text-xs font-semibold px-3 py-1 rounded-full mb-4"
                    style={{ background: info.color }}>
                    {info.tag}
                  </span>
                  <h2 className="text-xl font-bold mb-3 text-gray-900">{info.title}</h2>
                  <p className="text-sm text-gray-500 mb-5 leading-relaxed">{info.desc}</p>
                  <p className="text-xs text-gray-400 mb-2 font-medium">관련 제품 카테고리</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {info.tags.map((t) => (
                      <span key={t} className="text-xs px-3 py-1 rounded-full border font-medium"
                        style={{ borderColor: info.color, color: info.color }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <Link href={`/results?concern=${info.concern}`}>
                    <button className="w-full text-white rounded-full py-3 text-sm font-semibold transition hover:opacity-90"
                      style={{ background: info.color }}>
                      관련 제품 정보 보기 →
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-gray-400 gap-4 py-8">
                  <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="1.2">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">얼굴로 탐색하기</p>
                    <p className="text-xs text-gray-400 leading-relaxed">얼굴 부위에 마우스를 올리거나<br/>아래 버튼을 클릭하세요</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
