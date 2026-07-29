const UA = "Mozilla/5.0 (compatible; kbeautymatch-catalog/1.0)";
async function get(u) {
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    return { status: r.status, body: r.ok ? await r.text() : "" };
  } catch (e) {
    return { status: 0, body: "" };
  }
}

// 전성분이 확실히 있는 제품으로 시험한다
const CASES = [
  ["cosrx.com", "advanced-snail-96-mucin-power-essence"],
  ["cosrx.com", "the-vitamin-c-23-serum"],
  ["beautyofjoseon.com", "glow-serum-propolis-niacinamide"],
];

for (const [host, handleGuess] of CASES) {
  // 핸들을 정확히 얻는다
  const list = await get(`https://${host}/products.json?limit=250`);
  let handle = handleGuess;
  try {
    const ps = JSON.parse(list.body).products ?? [];
    const hit = ps.find((p) => p.handle.includes(handleGuess.split("-")[0]) && p.handle.includes(handleGuess.split("-").pop()));
    if (hit) handle = hit.handle;
  } catch {}

  console.log(`\n===== ${host} / ${handle} =====`);

  // 1) .js 엔드포인트
  const js = await get(`https://${host}/products/${handle}.js`);
  console.log(`  /products/${handle}.js  HTTP ${js.status}  길이 ${js.body.length}`);
  if (js.status === 200) {
    try {
      const j = JSON.parse(js.body);
      console.log("    최상위 키:", Object.keys(j).slice(0, 20).join(", "));
      if (j.metafields) console.log("    metafields:", JSON.stringify(j.metafields).slice(0, 200));
    } catch {}
  }

  // 2) 제품 페이지에서 JSON-LD / 인라인 JSON
  const page = await get(`https://${host}/products/${handle}`);
  const ld = [...page.body.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  console.log(`  JSON-LD 블록 ${ld.length}개`);
  for (const block of ld) {
    try {
      const j = JSON.parse(block);
      const t = Array.isArray(j) ? j.map((x) => x["@type"]).join(",") : j["@type"];
      console.log(`    @type=${t}`);
    } catch {}
  }
  // 3) 페이지 안에 「ingredients」를 키로 가진 JSON 조각이 있는가
  const inline = page.body.match(/"(?:ingredients|full_ingredients|inci)"\s*:\s*"([^"]{80,})"/i);
  console.log(`  인라인 JSON ingredients 키: ${inline ? "있음 — " + inline[1].slice(0, 90) : "없음"}`);

  // 4) 아코디언/탭 안 텍스트 위치
  const idx = page.body.toLowerCase().indexOf("ingredients");
  if (idx >= 0) {
    const around = page.body.slice(idx, idx + 400).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    console.log(`  'ingredients' 첫 등장 주변: ${around.slice(0, 180)}`);
  }
  await new Promise((r) => setTimeout(r, 800));
}
