/**
 * 운영 안내서(`docs/159-kr-mall-catalog-runbook.md`)에 적힌 **명령이 실제로 있는지** 본다.
 *
 * ## 왜 필요한가
 *
 * 안내서는 사람이 그대로 따라 치는 문서다. 스크립트 이름을 바꾸거나 지우면
 * 안내서가 **조용히 거짓말이 된다** — 문서는 아무 오류도 내지 않는다.
 * 새벽에 «가격이 이상하다» 는 말을 듣고 안내서대로 쳤는데 `npm error` 가 뜨는
 * 상황을 막는다.
 *
 * 2026-08-08~10 에 «오류는 안 나는데 아무 일도 안 일어나는» 결함을 여섯 번 만났다.
 * 안내서도 같은 방식으로 썩는다.
 *
 * 실행: npx tsx scripts/runbook-commands-selftest.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const RUNBOOK = "docs/159-kr-mall-catalog-runbook.md";

function main() {
  assert.ok(existsSync(RUNBOOK), `안내서가 없다: ${RUNBOOK}`);
  const doc = readFileSync(RUNBOOK, "utf8");
  const scripts = Object.keys(
    (JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> }).scripts ?? {}
  );

  const used = [...new Set([...doc.matchAll(/npm run ([a-z0-9:._-]+)/g)].map((m) => m[1]))];
  assert.ok(used.length > 0, "안내서에서 npm 명령을 하나도 못 찾았다 — 검사가 헛돌고 있다");

  const missing = used.filter((u) => !scripts.includes(u));
  assert.deepEqual(
    missing,
    [],
    `안내서에 적힌 명령이 package.json 에 없다:\n  ${missing.join("\n  ")}\n` +
      `→ 스크립트 이름을 바꿨다면 안내서도 같이 고쳐야 한다.`
  );

  // 안내서가 가리키는 파일도 실재해야 한다.
  const files = [...new Set([...doc.matchAll(/`([a-zA-Z0-9_/.-]+\.(?:ts|md|sql))`/g)].map((m) => m[1]))];
  const missingFiles = files.filter(
    (f) => !existsSync(f) && !existsSync(`docs/${f}`) && !existsSync(`src/lib/catalog/${f}`)
  );
  assert.deepEqual(missingFiles, [], `안내서가 없는 파일을 가리킨다:\n  ${missingFiles.join("\n  ")}`);

  console.log(`runbook-commands self-test: ok (명령 ${used.length}종 · 파일 ${files.length}개 확인)`);
}

main();
