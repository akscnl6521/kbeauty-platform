"use client";

import Link from "next/link";
import { SampleDataBadge } from "@/components/scaffold/SampleDataBadge";

type MockOffer = {
  productName: string;
  brand: string;
  retailer: string;
  price: string;
  url: string;
};

const MOCK_OFFERS: MockOffer[] = [
  {
    productName: "저자극 진정 토너",
    brand: "샘플브랜드 A",
    retailer: "공식몰 (예시)",
    price: "₩18,000",
    url: "#",
  },
  {
    productName: "판테놀 수분 크림",
    brand: "샘플브랜드 B",
    retailer: "올리브영 (예시)",
    price: "₩22,000",
    url: "#",
  },
  {
    productName: "무기자차 선크림 SPF50+",
    brand: "샘플브랜드 C",
    retailer: "공식몰 (예시)",
    price: "₩15,000",
    url: "#",
  },
];

export default function RoutinePurchasePage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">구매처</h1>
        <SampleDataBadge />
      </div>
      <p className="mt-2 text-sm text-gray-600">
        아래 구매처 정보는 실제 재고·가격이 아닌 스캐폴드용 샘플입니다.
      </p>

      <div className="mt-6 space-y-4">
        {MOCK_OFFERS.map((offer) => (
          <div
            key={offer.productName}
            className="rounded-2xl border border-[#E8DFD8] bg-white p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C2185B]">
              {offer.brand}
            </p>
            <h2 className="mt-1 font-semibold">{offer.productName}</h2>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                {offer.retailer} · {offer.price}
              </p>
              <a
                href={offer.url}
                className="rounded-lg bg-[#C2185B] px-3 py-1.5 text-xs font-semibold text-white"
                onClick={(e) => e.preventDefault()}
              >
                구매처 보기 (샘플)
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/routine"
          className="inline-flex rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-semibold"
        >
          ← 루틴으로 돌아가기
        </Link>
        <Link
          href="/routine/save"
          className="inline-flex rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
        >
          저장하기 →
        </Link>
      </div>
    </main>
  );
}
