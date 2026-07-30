import { loadDotEnvLocal } from "./_loadDotEnvLocal.ts";
loadDotEnvLocal();
const id = process.env.NAVER_SEARCH_CLIENT_ID, sec = process.env.NAVER_SEARCH_CLIENT_SECRET;
const TRUSTED = new Set(["올리브영", "쿠팡", "롯데ON", "SSG.COM", "신세계몰", "롯데닷컴", "11번가", "G마켓", "옥션"]);

async function q(query) {
  const r = await fetch(
    "https://openapi.naver.com/v1/search/shop.json?query=" + encodeURIComponent(query) + "&display=30",
    { headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": sec } }
  );
  if (!r.ok) return { total: 0, trusted: [] };
  const j = await r.json();
  const items = j.items ?? [];
  const trusted = items
    .map((it) => ({ mall: it.mallName, title: it.title.replace(/<[^>]+>/g, ""), price: it.lprice }))
    .filter((x) => TRUSTED.has(x.mall));
  return { total: j.total, count: items.length, trusted };
}

// 미확보 8건 — 긴 질의 vs 짧은 질의
const CASES = [
  [20, "토리든 Dive In Low Molecular Hyaluronic Acid Serum", "토리든 다이브인 세럼"],
  [28, "코스알엑스 Advanced Snail 92 All in One Cream", "코스알엑스 스네일 92 크림"],
  [104, "조선미녀 Glow Serum Propolis and Niacinamide", "조선미녀 글로우 세럼"],
  [105, "조선미녀 Revive Eye Serum Retinal and Caffeine", "조선미녀 리바이브 아이세럼"],
  [171, "스킨1004 Madagascar Centella Tone Brightening Capsule Ampoule", "스킨1004 톤브라이트닝 캡슐 앰플"],
  [190, "코스알엑스 Hydrium Watery Toner", "코스알엑스 하이드리움 워터리 토너"],
  [188, "코스알엑스 Low pH Good Morning Gel Cleanser", "코스알엑스 로우피에이치 굿모닝 젤 클렌저"],
  [86, "아누아 Heartleaf Soothing Toner", "아누아 어성초 77 토너"],
];

for (const [pid, long, short] of CASES) {
  const a = await q(long);
  await new Promise((r) => setTimeout(r, 250));
  const b = await q(short);
  console.log(
    `${String(pid).padStart(4)}  긴질의 신뢰 ${String(a.trusted.length).padStart(2)}/${String(a.count ?? 0).padStart(2)}` +
      `   짧은질의 신뢰 ${String(b.trusted.length).padStart(2)}/${String(b.count ?? 0).padStart(2)}`
  );
  if (b.trusted.length > 0) {
    for (const t of b.trusted.slice(0, 2))
      console.log(`        ${t.mall.padEnd(8)}${String(t.price).padStart(8)}원  ${t.title.slice(0, 46)}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}
