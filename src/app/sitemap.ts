import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

const BASE_URL = "https://kbeautymatch.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/quiz`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/results`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  let ingredientRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data, error } = await supabase
      .from("ingredients")
      .select("slug")
      .not("slug", "is", null);

    if (!error && data?.length) {
      ingredientRoutes = data.map((row) => ({
        url: `${BASE_URL}/ingredients/${row.slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }));
    }
  } catch (e) {
    console.error("[sitemap] ingredients fetch error", e);
  }

  return [...staticRoutes, ...ingredientRoutes];
}
