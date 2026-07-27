/**
 * 식약처(MFDS) 화장품 공공데이터 API 3종 연결 확인 — 읽기 전용.
 *
 * HIRA 수집에서 쓰던 안전 규약을 그대로 따른다 (`src/lib/publicData/secrets.ts`):
 *
 *   - 인증키와 인증된 URL 은 **어떤 경우에도 출력하지 않는다.** 화면에는
 *     호스트와 경로까지만 보여주고, 본문은 `redactSecrets` 를 통과시킨다.
 *   - 키가 우연히 응답 본문에 되비쳐 오더라도(일부 공공 API 가 그런다)
 *     그 자리에서 가려진다.
 *   - DB 를 건드리지 않는다. 이 파일에는 Supabase 클라이언트가 없다.
 *
 * data.go.kr 은 응답 형식이 서비스마다 제각각이라(`_type` / `type` / XML 고정)
 * JSON 을 두 가지 방식으로 요청해 보고, 그래도 XML 이면 XML 그대로 보여준다.
 * 형식을 추측해서 파싱하지 않는다.
 *
 * 실행:
 *   node --import ./scripts/register-server-only.mjs --import tsx/esm \
 *     scripts/probe-mfds-cosmetic-apis.ts
 */
import { loadDotEnvLocal } from "./_loadDotEnvLocal";

loadDotEnvLocal();

const KEY_ENV = "MFDS_DATA_GO_KR_SERVICE_KEY";

const TARGETS = [
  { label: "화장품 원료성분정보", env: "MFDS_COSMETIC_INGREDIENT_API_URL" },
  { label: "화장품 규제정보", env: "MFDS_COSMETIC_REGULATION_API_URL" },
  { label: "기능성화장품 보고품목정보", env: "MFDS_FUNCTIONAL_COSMETIC_REPORT_API_URL" },
] as const;

/** 호스트와 경로까지만. 쿼리스트링에는 인증키가 들어 있으므로 절대 보이지 않는다. */
function safeEndpoint(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return "(URL 형식이 아님)";
  }
}

/**
 * 값이 실제로 쓸 수 있는 것인지 본다. 값 자체는 절대 돌려주지 않는다 —
 * 왜 못 쓰는지만 한국어로 알려준다.
 *
 * 안내문의 `[...]` 자리표시자를 그대로 붙여넣는 일이 흔해서 그것부터 잡는다.
 */
function describeUnusable(value: string, expect: "url" | "key"): string | null {
  const v = value.trim();
  if (!v) return "값이 비어 있다";
  if (v.startsWith("[") && v.endsWith("]"))
    return "대괄호 자리표시자가 그대로 들어 있다 (실제 값으로 교체 필요)";
  if (expect === "url") {
    if (!/^https?:\/\//i.test(v)) return "http:// 또는 https:// 로 시작하지 않는다";
    try {
      new URL(v);
    } catch {
      return "URL 로 해석되지 않는다";
    }
    return null;
  }
  if (v.length < 20) return `인증키로 보기에 너무 짧다 (${v.length}자)`;
  return null;
}

async function callOnce(
  baseUrl: string,
  serviceKey: string,
  typeParam: "_type" | "type",
  redact: (s: string) => string
): Promise<{ status: number; contentType: string; body: string } | { error: string }> {
  const url = new URL(baseUrl);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "1");
  url.searchParams.set(typeParam, "json");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // url.toString() 은 인증키를 담고 있다. 로그로 나가지 않게 여기서만 쓴다.
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "application/json, text/xml;q=0.9, */*;q=0.8" },
    });
    const body = await res.text();
    return {
      status: res.status,
      contentType: res.headers.get("content-type") ?? "(없음)",
      body: redact(body),
    };
  } catch (e) {
    return { error: redact(e instanceof Error ? e.message : String(e)) };
  } finally {
    clearTimeout(timer);
  }
}

/** 응답에서 첫 레코드 하나만 꺼내 본다. 못 찾으면 앞부분을 그대로 보여준다. */
function firstRecord(body: string, contentType: string): string {
  if (/json/i.test(contentType) || /^\s*[{[]/.test(body)) {
    try {
      const parsed = JSON.parse(body);
      // data.go.kr 흔한 형태 두 가지만 알아본다. 없으면 통째로 보여준다.
      const item =
        parsed?.response?.body?.items?.item ??
        parsed?.response?.body?.items ??
        parsed?.body?.items ??
        parsed?.items ??
        null;
      const one = Array.isArray(item) ? item[0] : item;
      if (one) return JSON.stringify(one, null, 2);
      return JSON.stringify(parsed, null, 2).slice(0, 1400);
    } catch {
      // JSON 이라고 했는데 아니면 원문을 보여준다.
    }
  }
  const m = body.match(/<item>[\s\S]*?<\/item>/i);
  if (m) return m[0];
  return body.slice(0, 1400);
}

async function main() {
  const { redactSecrets, serviceKeyFingerprint } = await import(
    "../src/lib/publicData/secrets"
  );

  const problems: Array<[string, string]> = [];

  let serviceKey = (process.env[KEY_ENV] ?? "").trim();
  const keyProblem = describeUnusable(serviceKey, "key");
  if (keyProblem) {
    // data.go.kr 인증키는 서비스별이 아니라 **계정 단위**다. 이미 HIRA 수집에
    // 쓰고 있는 키가 있으면 같은 키로 식약처 API 도 호출된다.
    const fallback = (process.env["DATA_GO_KR_SERVICE_KEY"] ?? "").trim();
    if (!describeUnusable(fallback, "key")) {
      console.log(
        `${KEY_ENV} 를 쓸 수 없어(${keyProblem}) 기존 DATA_GO_KR_SERVICE_KEY 로 시도한다.\n` +
          "data.go.kr 인증키는 계정 단위라 같은 키로 식약처 API 도 호출된다.\n"
      );
      serviceKey = fallback;
    } else {
      problems.push([KEY_ENV, keyProblem]);
    }
  }

  for (const t of TARGETS) {
    const p = describeUnusable(process.env[t.env] ?? "", "url");
    if (p) problems.push([t.env, p]);
  }

  if (problems.length > 0) {
    console.log("아래 값을 .env.local 에서 고쳐야 호출할 수 있다 (값은 출력하지 않는다):\n");
    for (const [name, why] of problems) console.log(`  ${name}\n      -> ${why}`);
    console.log("\n고친 뒤 `npm run probe:mfds-cosmetic` 을 다시 실행하면 된다.");
    return;
  }

  const redact = (s: string) => redactSecrets(s, [serviceKey]);
  console.log(`인증키 확인됨 (지문 ${serviceKeyFingerprint(serviceKey)}) — 값 자체는 출력하지 않는다.\n`);

  for (const t of TARGETS) {
    const baseUrl = (process.env[t.env] ?? "").trim();
    console.log("=".repeat(70));
    console.log(`${t.label}`);
    console.log(`  엔드포인트: ${safeEndpoint(baseUrl)}`);

    let shown = false;
    for (const typeParam of ["_type", "type"] as const) {
      const res = await callOnce(baseUrl, serviceKey, typeParam, redact);
      if ("error" in res) {
        console.log(`  [${typeParam}=json] 호출 실패: ${res.error}`);
        continue;
      }
      console.log(`  [${typeParam}=json] HTTP ${res.status}  content-type: ${res.contentType}`);

      // 공공 API 는 인증 실패도 HTTP 200 + 본문 에러코드로 준다.
      const authProblem = /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE ERROR|등록되지 않은|인증키/i.test(res.body);
      if (authProblem) {
        console.log("  ⚠ 본문에 인증 관련 오류가 있다. 아래 응답을 확인할 것.");
      }
      console.log("  --- 응답 1건 ---");
      console.log(
        firstRecord(res.body, res.contentType)
          .split("\n")
          .map((l) => "  " + l)
          .join("\n")
      );
      shown = true;
      if (!authProblem && res.status === 200) break;
    }
    if (!shown) console.log("  두 방식 모두 응답을 받지 못했다.");
    console.log();
  }
}

main().catch((e) => {
  console.error(
    "[probe-mfds-cosmetic-apis] FAILED:",
    e instanceof Error ? e.message : e
  );
  process.exitCode = 1;
});
