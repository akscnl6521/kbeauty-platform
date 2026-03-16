import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4022588219132458"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
