const url =
  "https://haruharu.com/category/%ED%86%A0%EB%84%88%C2%B7%EB%AF%B8%EC%8A%A4%ED%8A%B8/166/";
const res = await fetch(url, {
  headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
  signal: AbortSignal.timeout(25000),
});
const t = await res.text();
const links = [...t.matchAll(/href="(\/product\/[^"]+)"/g)].map((m) => m[1]);
const uniq = [...new Set(links)].filter((h) =>
  /토너|toner|블랙라이스|hyaluron/i.test(decodeURIComponent(h))
);
console.log(JSON.stringify({ status: res.status, count: uniq.length, links: uniq }, null, 2));

for (const h of uniq.slice(0, 15)) {
  const full = "https://haruharu.com" + h.replace(/&amp;/g, "&");
  try {
    const r = await fetch(full, {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(20000),
    });
    const html = await r.text();
    const title = (html.match(/<title>([^<]+)/) || [])[1] || "";
    const sold = /SOLD OUT/i.test(html);
    const prices = [...html.matchAll(/([0-9]{1,3},[0-9]{3})\s*원/g)]
      .slice(0, 5)
      .map((x) => x[1]);
    const h1 = (html.match(/##\s*([^\n]*블랙라이스[^\n]*)/) ||
      html.match(/<meta property="og:title" content="([^"]+)"/) ||
      [])[1];
    console.log(
      JSON.stringify({
        url: full,
        status: r.status,
        title,
        h1,
        sold,
        prices,
      })
    );
  } catch (e) {
    console.log(JSON.stringify({ url: full, error: String(e) }));
  }
}
