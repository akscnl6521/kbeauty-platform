/**
 * `src/lib/catalog/mallRegistrationFilters.ts` 회귀 테스트.
 *
 * 사례는 전부 2026-08-08 달바·티르티르·설화수 실측에서 나온 **실제 상품명**이다.
 * 여기가 뚫리면 화면에 살 수 없는 가격이 뜨거나, 비비크림이 얼굴 세럼 추천에 섞인다.
 *
 * 실행: npx tsx scripts/mall-registration-filters-selftest.ts
 */
import assert from "node:assert/strict";
import {
  bundleSetReason,
  conditionalSaleReason,
  nonFaceSkincareReason,
  packagingNeutralKey,
} from "../src/lib/catalog/mallRegistrationFilters";

function main() {
  // ── 조건부 판매·단종은 막는다 ──────────────────────────────────
  for (const name of [
    "[주주우대] 화이트 트러플 모이스처라이징 세럼 로션 100ml",
    "[홈트라이 전용] 화이트 트러플 더블 세럼 앤 크림",
    "[미운영 코드] 프로페셔널 리페어링 세럼",
    "[미운영] 화이트 트러플 더블 세럼 앤 크림",
    "비타 토닝 캡슐 크림 (튜브형) - 리뉴얼 전버전",
  ]) {
    assert.ok(conditionalSaleReason(name), `조건부인데 통과했다: ${name}`);
  }

  // 정상 판매 상품을 막으면 안 된다 — 과잉 차단이 더 위험하다.
  for (const name of [
    "화이트 트러플 퍼스트 아로마틱 토너 155ml",
    "자음생크림 리치",
    "도자기 크림",
    "순행클렌징오일",
    "화이트 트러플 더블 마스크팩 (진정/보습) 2BOX",
  ]) {
    assert.equal(conditionalSaleReason(name), null, `정상인데 막혔다: ${name}`);
  }

  // ── 얼굴 스킨케어가 아닌 것은 막는다 ───────────────────────────
  // 넷 다 유형 추정이 «세럼»·«크림» 을 보고 얼굴 제품으로 넣었던 것들이다.
  for (const name of [
    "스킨 핏 커버 세럼 비비 크림",
    "글로우 핏 세럼 커버 쿠션 (미니)",
    "프로페셔널 리페어링 헤어 퍼퓸 세럼",
    "화이트 트러플 세럼 바디 크림",
    "퍼펙팅 틴티드 크림",
    "블랑 드 런웨이 올데이 세럼 메이크업 픽서",
    "화이트 트러플 너리싱 세럼 립 밤",
  ]) {
    assert.ok(nonFaceSkincareReason(name), `얼굴 제품이 아닌데 통과했다: ${name}`);
  }

  // 진짜 얼굴 스킨케어는 통과해야 한다.
  for (const name of [
    "화이트 트러플 엑스트라 퍼밍 크림 50ml",
    "자음생캡슐세럼",
    "탄력크림 EX",
    "밀크 팩 클렌저",
    "화이트 트러플 슬리핑 마스크",
    "비타 토닝 캡슐 클렌징 오일",
    "모이스트 프레쉬 선 미스트",
  ]) {
    assert.equal(nonFaceSkincareReason(name), null, `얼굴 제품인데 막혔다: ${name}`);
  }

  // ── 중복은 «포장·수량만 다를 때» 만 ────────────────────────────
  assert.equal(
    packagingNeutralKey("화이트 트러플 더블 마스크팩 (진정/보습) 2BOX (총 8개)"),
    packagingNeutralKey("화이트 트러플 더블 마스크팩 (진정/보습) 2BOX")
  );
  assert.equal(
    packagingNeutralKey("퍼스널 케어 마스크 10개 SET"),
    packagingNeutralKey("퍼스널 케어 마스크")
  );

  // **서로 다른 제품을 묶으면 안 된다.** 유사도 방식이 여기서 무너졌다 —
  // 달바는 거의 전부 «화이트 트러플 …» 로 시작해서 이름 대부분을 공유한다.
  const mustDiffer: Array<[string, string]> = [
    ["화이트 트러플 딥 클린 폼 클렌저", "화이트 트러플 퓨리파잉 젤 클렌저"],
    ["화이트 트러플 퓨리파잉 젤 클렌저", "화이트 트러플 리턴 오일 크림 클렌저 160ml"],
    ["자음생크림", "자음생크림 리치"],
    // 용량이 다르면 값이 다른 별개 상품이다 — 지우면 안 된다.
    ["화이트 트러플 퓨리파잉 앤 카밍 세럼 150ml", "화이트 트러플 퓨리파잉 앤 카밍 세럼 160ml"],
  ];
  for (const [a, b] of mustDiffer) {
    assert.notEqual(packagingNeutralKey(a), packagingNeutralKey(b), `다른 제품인데 묶였다: ${a} / ${b}`);
  }

  
  // ── 세트는 막는다 (전성분이 여러 제품의 합이라 안전 판정이 틀어진다) ──
  for (const name of [
    "★선착순 100명★ 기미 철벽커버 2종 세트",
    "블루 드롭+블루 크림 60g",
    "메이플 에너지 인퓨징 크림+세럼",
    "블루드롭20ml+클리어링 워터 크림50g 2종",
    "베이직&베스트 기초 3종 세트 (무향)",
  ]) {
    assert.ok(bundleSetReason(name), `세트인데 통과했다: ${name}`);
  }
  // 낱개 제품을 세트로 보면 안 된다.
  for (const name of [
    "화이트 트러플 엑스트라 퍼밍 크림 50ml",
    "자음생캡슐세럼",
    "1025 독도 토너 200ml",
    "센텔라 카밍 앰플",
    // `10개 SET` 은 **같은 제품 10개**다 — 전성분은 정상이고 수량만 다르다.
    // 세트(서로 다른 제품을 묶은 것)가 아니므로 여기서 막지 않는다.
    // 이런 수량 표기는 `packagingNeutralKey` 가 중복으로 잡는다.
    "퍼스널 케어 마스크 10개 SET",
  ]) {
    assert.equal(bundleSetReason(name), null, `낱개인데 세트로 막혔다: ${name}`);
  }

  // ── 행사 조건이 붙은 값은 막는다 (2026-08-08 에이프릴스킨 실측) ──
  for (const name of [
    "[1+1] 핑크알로에 뮤신세럼 (비타토너 15ml 증정)",
    "[5+5 / 9,900원 특가] 캐로틴 대왕 팩패드 (유통기한 임박)",
    "★선착순 100명★ 기미 철벽커버",
    "[비밀할인링크] 센텔라 카밍 앰플",
    "[여름한정특가] 기미 철벅커버",
    "[2천원 추가할인] 센텔라 카밍 앰플",
  ]) {
    assert.ok(conditionalSaleReason(name), `조건부인데 통과했다: ${name}`);
  }
  // 색조가 더 있었다.
  assert.ok(nonFaceSkincareReason("히어로 올데이 플럼핑 틴트"));
  assert.ok(nonFaceSkincareReason("[NEW] 히어로 글레이즈 립글로스"));
  assert.ok(nonFaceSkincareReason("블러 스킨 파우더"));
  assert.ok(nonFaceSkincareReason("퍼펙트 수정화장패드 (1개월분)"));
  // 세안제인 파우더는 얼굴 스킨케어다 — 막으면 안 된다.
  assert.equal(nonFaceSkincareReason("효소 파우더 클렌저"), null);
  assert.equal(nonFaceSkincareReason("아미노 파우더 워시"), null);

  console.log("mall-registration-filters self-test: ok");
}

main();
