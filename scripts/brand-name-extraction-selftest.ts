/**
 * 쇼핑몰 이름이 브랜드명 칸에 들어가는 것을 막는 규칙 고정.
 *
 * 2026-07-27: sioris.co.kr 이 JSON-LD `brand.name` 에 «시오리스 온라인 공식몰»
 * 을 신고했고, 제품 24건이 그 이름으로 저장됐다. 가게 이름이지 브랜드가 아니다.
 *
 * 브랜드명을 바꾸거나 번역하지 않는다(§35.3). 뒤에 붙은 가게 표현만 뗀다.
 */
import assert from "node:assert/strict";
import { cleanBrandName } from "../src/lib/catalog/officialCrawl";

// 가게를 가리키는 말은 뗀다
assert.equal(cleanBrandName("시오리스 온라인 공식몰"), "시오리스");
assert.equal(cleanBrandName("아비브 공식몰"), "아비브");
assert.equal(cleanBrandName("톤앤코 스토어"), "톤앤코");
assert.equal(cleanBrandName("SIORIS Official Store"), "SIORIS");
assert.equal(cleanBrandName("Abib Online Shop"), "Abib");

// 브랜드명은 그대로 둔다
assert.equal(cleanBrandName("Abib Cosmetic"), "Abib Cosmetic");
assert.equal(cleanBrandName("아로마티카"), "아로마티카");
assert.equal(cleanBrandName("Round Lab"), "Round Lab");
assert.equal(cleanBrandName("Beauty of Joseon"), "Beauty of Joseon");
assert.equal(cleanBrandName("넘버즈인"), "넘버즈인");

// 쓸 수 없는 값
assert.equal(cleanBrandName(null), null);
assert.equal(cleanBrandName("  "), null);
assert.equal(cleanBrandName("Unknown"), null);
assert.equal(cleanBrandName("공식몰"), null, "가게 표현만 있으면 브랜드가 아니다");
assert.equal(cleanBrandName("Official Store"), null);

console.log("brand name extraction selftest: ok");
