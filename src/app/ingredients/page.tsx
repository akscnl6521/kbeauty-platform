import Link from "next/link";

const ingredients = [
  ["나이아신아마이드", "niacinamide"],
  ["세라마이드", "ceramide"],
  ["히알루론산", "hyaluronic-acid"],
];

export default function IngredientsPage() {
  return <main className="mx-auto min-h-[60vh] max-w-4xl px-5 py-14">
    <p className="text-sm font-semibold text-[#C2185B]">성분 가이드</p>
    <h1 className="mt-3 text-3xl font-bold">성분 정보를 차분히 확인하세요</h1>
    <p className="mt-4 text-gray-600">제품의 최신 전성분과 사용 시 주의사항은 구매 전에 공식 페이지에서 다시 확인해 주세요.</p>
    <ul className="mt-8 grid gap-3 sm:grid-cols-3">{ingredients.map(([label, slug]) => <li key={slug}><Link href={`/ingredients/${slug}`} className="block rounded-xl border border-pink-100 bg-white p-5 font-medium hover:border-[#C2185B]">{label} →</Link></li>)}</ul>
  </main>;
}
