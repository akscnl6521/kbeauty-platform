/**
 * 국내 공식몰 제품 목록을 **한 번만 받아 파일로 남긴다.**
 *
 * 대조 규칙을 고칠 때마다 몰을 다시 긁으면 상대 서버에 부담이고, 실제로 2026-08-04
 * 에 반복 접근 끝에 연결이 거부됐다. 스냅샷을 떠 두면 대조 실험은 오프라인에서 한다.
 *
 * 읽기 전용 — DB 를 건드리지 않는다. 사이트맵은 크롤러가 읽으라고 두는 것이고,
 * 요청 간격을 넉넉히 둔다.
 *
 * 실행: npm run snapshot:kr-malls
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { KR_MALLS } from "../src/lib/catalog/krMalls";
import { decodeHtmlBody } from "../src/lib/catalog/decodeHtmlBody";
import { parseMallProductJsonLd, type MallProduct } from "../src/lib/catalog/mallProductData";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
/** 상대 서버 부담을 줄인다. 급하게 긁다가 차단당하면 다음 실행이 아예 안 된다. */
const DELAY_MS = 700;

function decodeXml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

async function get(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return r.ok ? await decodeHtmlBody(r) : "";
  } catch {
    return "";
  }
}

async function main() {
  const out: Record<string, Array<MallProduct & { url: string }>> = {};

  for (const mall of KR_MALLS) {
    const sm = await get(`https://${mall.domain}/sitemap.xml`);
    const urls = [
      ...new Set(
        [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)]
          .map((m) => decodeXml(m[1]))
          .filter((u) => /shopdetail|\/product\/|goods|item/i.test(u))
      ),
    ];
    console.log(`${mall.domain.padEnd(22)} 제품 URL ${urls.length}개 — 읽는 중…`);

    const items: Array<MallProduct & { url: string }> = [];
    let failed = 0;
    for (const u of urls) {
      const html = await get(u);
      if (!html) {
        failed += 1;
        // 연속 실패가 쌓이면 차단으로 보고 멈춘다 — 계속 두드리지 않는다.
        if (failed >= 10) {
          console.log(`  !! 연속 실패 ${failed}건 — 차단으로 보고 이 몰은 중단한다`);
          break;
        }
      } else {
        failed = 0;
        const p = parseMallProductJsonLd(html);
        if (p) items.push({ url: u, ...p });
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    out[mall.domain] = items;
    console.log(
      `  ${mall.domain} → 가격 있음 ${items.length}개 · 재고 있음 ${items.filter((i) => i.inStock).length}개`
    );
  }

  mkdirSync("artifacts/kr-malls", { recursive: true });
  const path = "artifacts/kr-malls/snapshot.json";
  writeFileSync(path, JSON.stringify({ takenAt: new Date().toISOString(), malls: out }, null, 2), "utf8");
  console.log(`\n스냅샷 저장: ${path}`);
}

main().catch((e) => {
  console.error("[snapshot-kr-malls] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
