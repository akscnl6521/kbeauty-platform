import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KBEAUTY GUIDE - Find Your Perfect K-Beauty Match",
  description:
    "Personalized K-beauty recommendations based on your skin tone, concerns and budget. Find the best Korean skincare products with ingredient research.",
  keywords: [
    "K-beauty",
    "Korean skincare",
    "skin tone",
    "ingredients",
    "recommendations",
  ],
  openGraph: {
    title: "KBEAUTY GUIDE - Find Your Perfect K-Beauty Match",
    description:
      "Personalized K-beauty recommendations based on your skin tone, concerns and budget. Find the best Korean skincare products with ingredient research.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
        {children}
      </body>
    </html>
  );
}
