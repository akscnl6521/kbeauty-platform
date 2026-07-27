import type { Metadata } from "next";
import "./globals.css";
import { PublicChrome } from "@/components/site/PublicChrome";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const metadataBase = siteUrl ? new URL(siteUrl) : undefined;
const title = "K-Beauty Match";
const description =
  "피부 고민과 성분 정보를 바탕으로 K-뷰티 제품과 관리 루틴을 탐색할 수 있는 가이드입니다.";

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: title,
    template: `%s | ${title}`,
  },
  description,
  keywords: [
    "K-beauty",
    "Korean skincare",
    "ingredients",
    "K-뷰티",
    "성분 정보",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    locale: "ko_KR",
  },
  robots: { index: true, follow: true },
  alternates: siteUrl ? { canonical: "/" } : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/*
          Type roles (design-system/MASTER.md):
            display — Fraunces (latin) + Gowun Batang (한글 명조). Korean is the
              primary script here, so the display face has to carry 한글 itself
              rather than falling back to whatever the OS ships.
            body/UI — DM Sans (latin, numerals) + IBM Plex Sans KR (한글).
            Playfair Display is legacy: still referenced inline by /results,
              /routine, /analyze and /ingredients. Drop it from this list once
              those screens move to `.kb-display`.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this rule targets pages/_document.js single-page loads; the App Router root layout is the correct, app-wide place for this link */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,SOFT,wght@9..144,0..100,400..700&family=Gowun+Batang:wght@400;700&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Playfair+Display:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4022588219132458"
          crossOrigin="anonymous"
        />
      </head>
      {/* Canvas, ink and font stack all come from globals.css tokens — hard-coded
          body classes used to shadow them with a slightly different paper. */}
      <body>
        <PublicChrome>{children}</PublicChrome>
      </body>
    </html>
  );
}
