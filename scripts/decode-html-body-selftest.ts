/**
 * HTML 본문 인코딩 판별 회귀 테스트.
 *
 * 2026-08-05 — 국내몰(`cosrx.co.kr`)이 EUC-KR 로 서비스하는데 `response.text()` 로
 * 읽어 한글이 통째로 깨졌다. 깨진 이름은 제품 대조 점수가 **전부 0.00** 이 되어
 * «국내몰에 그 제품이 없다» 는 잘못된 결론으로 이어졌다. 실제로는 있었다.
 *
 * 조용히 틀리는 종류의 결함이라 테스트로 고정한다.
 *
 * 실행: npm run test:decode-html-body
 */
import assert from "node:assert/strict";
import { decodeHtmlBody } from "../src/lib/catalog/decodeHtmlBody";


/** 실제 fetch 없이 `Response` 를 만들어 넣는다. */
function res(bytes: Uint8Array, contentType?: string): Response {
  return new Response(bytes, {
    headers: contentType ? { "content-type": contentType } : {},
  });
}

/** 한글을 EUC-KR 바이트로 — 테스트 표본을 위해 알려진 값만 직접 쓴다. */
const EUCKR_HANGUL = {
  // "카밍" = 0xC4AB 0xB9D6, "폼" = 0xC6FB
  카밍폼: new Uint8Array([0xc4, 0xab, 0xb9, 0xd6, 0xc6, 0xfb]),
};

async function main() {
  // ── 헤더의 charset 을 따른다 ──
  {
    const body = new Uint8Array([
      ...new TextEncoder().encode("<html><body>"),
      ...EUCKR_HANGUL.카밍폼,
      ...new TextEncoder().encode("</body></html>"),
    ]);
    const out = await decodeHtmlBody(res(body, "text/html; charset=euc-kr"));
    assert.ok(out.includes("카밍폼"), `헤더 charset 을 따라야 한다: ${JSON.stringify(out)}`);
  }

  // ── 헤더에 charset 이 없으면 meta 태그를 본다 (cosrx.co.kr 실제 형태) ──
  {
    const body = new Uint8Array([
      ...new TextEncoder().encode('<html><head><meta charset="euc-kr"></head><body>'),
      ...EUCKR_HANGUL.카밍폼,
      ...new TextEncoder().encode("</body></html>"),
    ]);
    // 헤더는 `text/html` 만 준다 — 실제 몰이 이렇게 응답한다.
    const out = await decodeHtmlBody(res(body, "text/html"));
    assert.ok(out.includes("카밍폼"), `meta charset 을 따라야 한다: ${JSON.stringify(out)}`);
  }

  // ── http-equiv 형태도 읽는다 (구형 페이지) ──
  {
    const body = new Uint8Array([
      ...new TextEncoder().encode(
        '<html><head><meta http-equiv="Content-Type" content="text/html; charset=ks_c_5601-1987"></head><body>'
      ),
      ...EUCKR_HANGUL.카밍폼,
      ...new TextEncoder().encode("</body></html>"),
    ]);
    const out = await decodeHtmlBody(res(body, "text/html"));
    assert.ok(out.includes("카밍폼"), "ks_c_5601-1987 은 euc-kr 과 같다");
  }

  // ── UTF-8 은 그대로 읽는다 ──
  {
    const body = new TextEncoder().encode("<html><body>글로우 세럼</body></html>");
    assert.ok((await decodeHtmlBody(res(body, "text/html; charset=utf-8"))).includes("글로우 세럼"));
    // 선언이 아예 없으면 UTF-8 로 본다 (요즘 기본값)
    assert.ok((await decodeHtmlBody(res(body))).includes("글로우 세럼"));
  }

  // ── 헤더가 meta 보다 우선한다 ──
  {
    const body = new TextEncoder().encode('<html><head><meta charset="euc-kr"></head><body>세럼</body></html>');
    const out = await decodeHtmlBody(res(body, "text/html; charset=utf-8"));
    assert.ok(out.includes("세럼"), "헤더가 UTF-8 이면 헤더를 따라야 한다");
  }

  // ── 알 수 없는 인코딩이면 UTF-8 로 되돌리고 죽지 않는다 ──
  {
    const body = new TextEncoder().encode("<html><body>세럼</body></html>");
    const out = await decodeHtmlBody(res(body, "text/html; charset=x-made-up-99"));
    assert.ok(out.includes("세럼"), "모르는 인코딩이어도 예외로 수집을 멈추면 안 된다");
  }

  // ── 빈 본문 ──
  assert.equal(await decodeHtmlBody(res(new Uint8Array())), "");
}

main()
  .then(() => console.log("decode-html-body self-test: ok"))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
