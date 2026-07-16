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
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4022588219132458"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased bg-[#FAFAF8] text-[#1A1A1A] font-['DM_Sans',system-ui,sans-serif]">
        <PublicChrome>{children}</PublicChrome>
      </body>
    </html>
  );
}
