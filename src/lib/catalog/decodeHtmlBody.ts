/**
 * HTML 응답을 **선언된 문자 인코딩으로** 읽는다.
 *
 * ## 왜 필요한가
 *
 * 국내 쇼핑몰 상당수가 아직 EUC-KR(CP949)로 서비스한다. `await response.text()` 는
 * 무조건 UTF-8 로 읽으므로 한글이 통째로 깨진다.
 *
 * 2026-08-05 실측 — `cosrx.co.kr` 제품명이 이렇게 들어왔다:
 *
 *   `AC 컬렉션 카밍 폼 클렌저 150ml`  →  `AC �÷��� ī�� �� Ŭ���� 150ml`
 *
 * 깨진 이름은 제품 대조 점수가 **전부 0.00** 이 된다. 그래서 «국내몰에 그 제품이
 * 없다» 고 잘못 판단했다 — 실제로는 있는데 읽지 못한 것이었다.
 *
 * ## 인코딩을 정하는 순서
 *
 *   1. HTTP `Content-Type` 헤더의 `charset`
 *   2. HTML `<meta charset>` / `<meta http-equiv="Content-Type">`
 *   3. 둘 다 없으면 UTF-8
 *
 * 헤더를 먼저 보는 것은 표준 우선순위이고, 메타 태그는 바이트를 한 번 훑어야
 * 읽을 수 있어 **ASCII 범위로만** 찾는다(어차피 태그는 ASCII 다).
 */

/** 같은 인코딩의 여러 표기를 하나로 모은다. */
function canonicalEncoding(raw: string): string {
  const k = raw.trim().toLowerCase().replace(/["']/g, "");
  if (!k) return "utf-8";
  if (k === "ks_c_5601-1987" || k === "ksc5601" || k === "cp949" || k === "ms949") return "euc-kr";
  return k;
}

function charsetFromContentType(contentType: string | null): string | null {
  const m = String(contentType ?? "").match(/charset\s*=\s*([^;\s]+)/i);
  return m ? canonicalEncoding(m[1]) : null;
}

function charsetFromMeta(bytes: Uint8Array): string | null {
  // 메타 태그는 문서 앞부분에 있고 ASCII 다. 앞 4KB 만 ASCII 로 훑는다.
  const head = new TextDecoder("ascii").decode(bytes.subarray(0, 4096));
  const m =
    head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i) ??
    head.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i);
  return m ? canonicalEncoding(m[1]) : null;
}

/**
 * 응답 본문을 올바른 인코딩으로 디코딩한다.
 *
 * 알 수 없는 인코딩이면 UTF-8 로 되돌린다 — 깨진 글자를 내보낼지언정 예외로
 * 수집 전체를 멈추지는 않는다.
 */
export async function decodeHtmlBody(response: Response): Promise<string> {
  const buf = new Uint8Array(await response.arrayBuffer());
  const declared = charsetFromContentType(response.headers.get("content-type")) ?? charsetFromMeta(buf);
  const encoding = declared ?? "utf-8";
  try {
    return new TextDecoder(encoding).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}
