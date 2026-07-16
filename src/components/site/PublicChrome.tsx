"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * Public chrome only — /admin keeps its own layout (no SiteHeader).
 */
export function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="main-content" className="public-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
