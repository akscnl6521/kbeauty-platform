import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/my/"],
    },
    sitemap: siteUrl ? `${siteUrl.replace(/\/$/, "")}/sitemap.xml` : undefined,
  };
}
