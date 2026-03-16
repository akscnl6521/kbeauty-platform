"use client";

import Head from "next/head";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Head>
        <title>Terms of Service | KBEAUTY GUIDE</title>
        <meta
          name="description"
          content="Terms of Service for KBEAUTY GUIDE, outlining information purpose, medical disclaimer, and affiliate disclosure."
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </header>

        <section className="space-y-6 text-sm leading-relaxed text-gray-700">
          <h2 className="text-base font-semibold text-gray-900">
            1. 서비스 정보 제공 목적
          </h2>
          <p>
            KBEAUTY GUIDE는 K-뷰티 제품 및 성분에 대한 정보를 정리·제공하여
            사용자가 보다 쉽게 한국 스킨케어 제품을 이해하고 선택할 수 있도록
            돕는 것을 목적으로 합니다. 본 서비스에서 제공하는 모든 정보는
            일반적인 정보 제공을 위한 것이며, 개별 사용자에 대한 맞춤형
            전문상담이나 진단을 대체하지 않습니다.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            2. 의료 면책 조항 (Medical Disclaimer)
          </h2>
          <p>
            본 사이트의 콘텐츠(텍스트, 이미지, 그래프, 링크 등)는 의료적 조언,
            진단 또는 치료를 위한 것이 아닙니다. 피부 질환, 알레르기, 기타
            건강 문제와 관련하여 의문이 있는 경우 반드시 피부과 전문의 또는
            의료 전문가와 상담해야 합니다.
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              당사는 특정 제품 또는 성분이 특정 사용자에게 안전하거나 효과적일
              것이라고 보증하지 않습니다.
            </li>
            <li>
              제품 사용으로 인해 발생할 수 있는 부작용, 알레르기 반응 등에
              대해서는 사용자 본인의 책임 하에 사용해야 합니다.
            </li>
          </ul>

          <h2 className="text-base font-semibold text-gray-900">
            3. 제휴 링크 및 광고 공시 (Affiliate Disclosure)
          </h2>
          <p>
            KBEAUTY GUIDE는 YesStyle, Amazon, Sephora, Qoo10, 올리브영, 쿠팡,
            네이버쇼핑 등 외부 온라인 스토어에 대한 제휴 링크 및 광고 링크를
            포함할 수 있습니다. 사용자가 이러한 링크를 통해 상품을 구매할 경우,
            당사는 추가 비용 없이 일정 커미션을 받을 수 있습니다.
          </p>
          <p>
            제휴 링크의 존재는 당사가 해당 제품 또는 브랜드를 보증하거나
            보장한다는 의미가 아니며, 제품 선택과 구매에 대한 최종 책임은
            사용자에게 있습니다.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            4. 서비스 변경 및 중단
          </h2>
          <p>
            당사는 사전 공지 없이 언제든지 서비스의 일부 또는 전부를 변경,
            일시 중단 또는 종료할 수 있습니다. 이로 인해 발생할 수 있는 손해에
            대해서는 법에서 허용하는 한도 내에서 책임을 지지 않습니다.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            5. 책임 제한 (Limitation of Liability)
          </h2>
          <p>
            KBEAUTY GUIDE 및 그 운영자, 협력사, 파트너는 서비스 이용 또는
            이용불가, 혹은 제공된 정보에 의존함으로써 발생하는 직접적, 간접적,
            우발적, 특별 또는 결과적 손해에 대해 책임을 지지 않습니다.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            6. 약관 변경
          </h2>
          <p>
            본 이용약관은 필요 시 변경될 수 있으며, 중대한 변경 사항이 있을
            경우 사이트 내 공지 또는 이메일 등을 통해 안내합니다. 변경 이후
            사이트를 계속 이용하는 경우, 변경된 약관에 동의한 것으로 간주됩니다.
          </p>
        </section>
      </main>
    </div>
  );
}

