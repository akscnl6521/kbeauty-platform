"use client";

import Head from "next/head";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Head>
        <title>Privacy Policy | KBEAUTY GUIDE</title>
        <meta
          name="description"
          content="Privacy policy for KBEAUTY GUIDE, explaining how we collect IP addresses, use cookies, show ads and affiliate links."
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </header>

        <section className="space-y-6 text-sm leading-relaxed text-gray-700">
          <p>
            KBEAUTY GUIDE (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a
            K-beauty information platform that helps users discover Korean
            skincare products, ingredients and routines. This Privacy Policy
            explains how we collect, use, and protect your information when you
            use our website.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            1. IP 주소 수집 (국가 감지용)
          </h2>
          <p>
            KBEAUTY GUIDE는 사용자의 대략적인 국가/지역을 파악하기 위해 IP
            주소 기반 지리 정보를 조회합니다. 이 정보는 국가별 구매처(예:
            미국: Sephora/Amazon, 한국: 올리브영/쿠팡/네이버쇼핑 등)를
            추천하기 위한 용도로만 사용되며, 개별 사용자를 특정하기 위한
            목적이 아닙니다.
          </p>
          <p>
            IP 기반 위치 정보는 제3자 API 서비스(예: ipapi.co)를 통해 수집될 수
            있으며, 법적 요구가 없는 한 원본 IP 로그는 최소한으로 보관하거나
            익명화합니다.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            2. Cookies 및 유사 기술 사용
          </h2>
          <p>
            당사는 사용자 경험 개선과 언어/국가 설정 유지, 분석 및 광고 목적을
            위해 쿠키(Cookies)와 로컬 스토리지(Local Storage)와 같은 유사
            기술을 사용할 수 있습니다.
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <span className="font-semibold">언어 및 환경 설정:</span> 선택한
              언어(예: 영어/일본어) 및 국가 기반 구매처 설정을 저장하여 다음
              방문 시 동일 환경을 제공합니다.
            </li>
            <li>
              <span className="font-semibold">분석 목적:</span> 페이지 조회수,
              클릭, 滞在 시간 등을 집계하여 서비스 개선에 활용할 수 있습니다.
            </li>
          </ul>
          <p>
            브라우저 설정을 통해 쿠키를 차단하거나 삭제할 수 있지만, 일부
            기능이 제한될 수 있습니다.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            3. Google AdSense 광고
          </h2>
          <p>
            본 사이트는 Google AdSense 또는 유사한 광고 네트워크를 통해 광고를
            게재할 수 있습니다. 이 경우 제3자 광고 파트너는 쿠키 및 광고
            식별자를 사용하여 사용자 관심사에 기반한 맞춤형 광고를 제공할 수
            있습니다.
          </p>
          <p>
            Google 및 제3자 파트너가 데이터를 처리하는 방식에 대한 자세한
            내용은 각 파트너의 개인정보처리방침(예: Google Privacy &amp; Terms)
            을 참고해 주십시오.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            4. 제휴 링크(Affiliate Links) 사용
          </h2>
          <p>
            KBEAUTY GUIDE는 특정 온라인 스토어(예: YesStyle, Amazon, Sephora,
            Qoo10, 올리브영, 쿠팡, 네이버쇼핑 등)에 대한 제휴 링크를 사용할 수
            있습니다. 사용자가 이러한 제휴 링크를 통해 상품을 구매하는 경우,
            당사는 일정 커미션을 받을 수 있습니다. 이 과정에서 사용자의
            구매정보는 제휴 파트너 시스템에서 처리되며, 우리는 개별 결제 카드
            정보 등을 직접 수집하지 않습니다.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            5. 정보 보안 및 보관
          </h2>
          <p>
            우리는 합리적인 기술적, 관리적, 물리적 보호조치를 통해 수집한
            정보를 보호하기 위해 노력합니다. 그러나 인터넷을 통한 전송 또는
            전자 저장 방식은 100% 안전을 보장할 수 없으므로, 절대적인 보안을
            보장할 수는 없습니다.
          </p>

          <h2 className="text-base font-semibold text-gray-900">
            6. 개인정보 관련 문의
          </h2>
          <p>
            개인정보 처리 방식에 대한 질문, 열람/정정/삭제 요청, 기타 프라이버시
            관련 문의가 있는 경우 아래 연락처로 문의해 주세요.
          </p>
          <p className="mt-1">
            <span className="font-semibold">Email:</span>{" "}
            <a
              href="mailto:contact@kbeautyguide.com"
              className="text-[#C2185B] underline"
            >
              contact@kbeautyguide.com
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

