import { enrichOfficialUrl } from "@/lib/catalog/enrichment";

async function main() {
  const targets = [
    {
      id: "cosrx-advanced-snail-96",
      brand: "COSRX",
      brandId: "cosrx",
      name: "COSRX Advanced Snail 96 Mucin Power Essence",
      url: "https://www.cosrx.co.kr/products/x",
      cat: "essence",
    },
    {
      id: "beauty-of-joseon-relief-sun",
      brand: "Beauty of Joseon",
      brandId: "beauty-of-joseon",
      name: "Beauty of Joseon Relief Sun",
      url: "https://beautyofjoseon.com/products/relief-sun-rice-probiotics",
      cat: "sunscreen",
    },
  ];
  for (const t of targets) {
    const r = await enrichOfficialUrl({
      externalProductId: t.id,
      brand: t.brand,
      brandIdHint: t.brandId,
      nameRaw: t.name,
      category: t.cat,
      officialUrl: t.url,
      curatedProvenance: "known_hero",
    });
    console.log(
      JSON.stringify({
        id: t.id,
        matchClass: r.matchClass,
        reasons: r.reasons,
        inci: r.fullIngredients.length,
        name: r.officialName,
        img: Boolean(r.imageRemoteUrl),
        url: r.officialUrl,
        robots: r.robotsAllowed,
      })
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
