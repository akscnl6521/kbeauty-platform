/**
 * Pure-logic assertions for §36.5 usage guidance extraction.
 * Fixtures are verbatim excerpts captured from official brand product pages
 * on 2026-07-27. Offline: no network, no DB.
 */
import assert from "node:assert/strict";
import {
  extractUsageGuidance,
  hasUsableGuidance,
  htmlToVisibleText,
  looksMojibake,
  productSpecificCautions,
} from "../src/lib/catalog/enrichment/extractUsageGuidance";

// --- numbuzin (numbuzin.com) -------------------------------------------------
const numbuzin = `
상품 상세
사용방법
2~3회 펌핑하여 얼굴 전체에 펴 바른 후, 가볍게 두드려 흡수시켜 줍니다.
*붉은 색은 인공색소가 아닌 원료 고유의 색상으로 고온과 직사광선에 장시간 노출 시 변색 현상이 발생할 수 있습니다.
화장품제조업자 ㈜씨앤씨인터내셔널
전성분 콜라겐수, 다이프로필렌글라이콜
사용할 때의 주의사항
가. 화장품 사용 시 또는 사용 후 직사광선에 의하여 사용부위가 붉은 반점, 부어오름 또는 가려움증 등의 이상 증상이나 부작용이 있는 경우에는 전문의 등과 상담할 것
나. 상처가 있는 부위 등에는 사용을 자제할 것
다. 보관 및 취급 시 주의사항
배송 안내
`;

const a = extractUsageGuidance(numbuzin);
assert.equal(a.amountLabel, "2~3회 펌핑", "amount is captured verbatim");
assert.ok(a.methodSteps.length >= 1, "method steps captured");
assert.ok(
  a.methodSteps[0].includes("얼굴 전체에 펴 바른"),
  "first step is the instruction sentence"
);
assert.deepEqual(a.applicationArea, ["얼굴 전체"], "area from the method text");
assert.ok(
  !a.methodSteps.some((step) => step.startsWith("*")),
  "footnote asides are dropped"
);
assert.ok(
  !a.methodSteps.some((step) => step.includes("화장품제조업자")),
  "section stops before the manufacturer block"
);
assert.ok(
  !a.methodSteps.some((step) => step.includes("콜라겐수")),
  "ingredient list never leaks into usage steps"
);
assert.equal(hasUsableGuidance(a), true, "usable");
assert.ok(a.cautions.length >= 2, "cautions captured");
assert.ok(
  a.cautions.every((caution) => caution.kind === "statutory"),
  "the mandated boilerplate is labelled statutory, not product-specific"
);
assert.deepEqual(
  productSpecificCautions(a),
  [],
  "no product-specific caution is claimed when the page only has boilerplate"
);
assert.ok(
  !a.cautions.some((caution) => caution.text.includes("배송")),
  "shipping notice is not a caution"
);

// --- LANEIGE (laneige.com) ---------------------------------------------------
const laneige = `
상품 특징
HOW TO USE
스킨케어 마무리 후 얼굴 전체에 가볍게 도포합니다.
특히 유분이 잘 올라오는 부위에는 한번 더 레이어링해서 발라주세요.
전성분/주의사항
주의사항
1) 화장품 사용 시 또는 사용 후 직사광선에 의하여 사용부위가 붉은 반점, 부어오름 또는 가려움증 등의 이상 증상이나 부작용이 있는 경우에는 전문의 등과 상담할 것
2) 상처가 있는 부위 등에는 사용을 자제할 것
`;

const b = extractUsageGuidance(laneige);
assert.ok(b.methodSteps.length >= 1, "English heading is recognised");
assert.ok(
  b.orderHints.some((hint) => hint.includes("스킨케어")),
  "routine order phrase captured verbatim"
);
assert.deepEqual(b.applicationArea, ["얼굴 전체"], "area captured");
assert.equal(b.amountLabel, null, "no amount stated → stays null, not guessed");
assert.ok(
  b.missingFields.includes("amountLabel"),
  "missing amount is reported rather than filled in"
);

// --- order and timing --------------------------------------------------------
const evening = extractUsageGuidance(`
사용방법
세안 후 저녁에 적당량을 덜어 얼굴과 목에 부드럽게 펴 발라줍니다.
전성분
`);
assert.equal(evening.amountLabel, "적당량", "적당량 counts as a stated amount");
assert.equal(evening.frequency, "evening", "evening timing detected");
assert.ok(evening.orderHints.includes("세안 후"), "세안 후 captured");
assert.deepEqual(
  evening.applicationArea.sort(),
  ["목", "얼굴"].sort(),
  "multiple areas captured"
);

const weekly = extractUsageGuidance(`
사용법
주 2회, 콩알 크기만큼 덜어 이마와 볼에 펴 바릅니다.
전성분
`);
assert.equal(weekly.frequency, "weekly", "weekly cadence detected");
assert.ok(weekly.amountLabel?.startsWith("콩알"), "콩알 크기 captured");

// --- nothing to extract ------------------------------------------------------
const empty = extractUsageGuidance(`
제품 설명
피부에 수분을 더해주는 제품입니다.
배송 안내
`);
assert.deepEqual(empty.methodSteps, [], "no usage section → no steps invented");
assert.equal(empty.amountLabel, null, "no amount invented");
assert.deepEqual(empty.applicationArea, [], "no area invented");
assert.equal(empty.frequency, null, "no frequency invented");
assert.equal(hasUsableGuidance(empty), false, "not usable");
assert.ok(
  empty.missingFields.includes("methodSteps"),
  "missing steps reported"
);

// --- a product-specific caution is told apart from boilerplate ---------------
const specific = extractUsageGuidance(`
사용방법
세안 후 적당량을 얼굴에 펴 바릅니다.
주의사항
레티놀 성분이 포함되어 있어 낮에는 자외선 차단제를 함께 사용해 주세요.
어린이의 손이 닿지 않는 곳에 보관할 것
전성분
`);
const specificCautions = productSpecificCautions(specific);
assert.equal(specificCautions.length, 1, "one product-specific caution");
assert.ok(
  specificCautions[0].includes("자외선 차단제"),
  "the product-specific caution is the retinol note"
);
assert.ok(
  specific.cautions.some((caution) => caution.kind === "statutory"),
  "boilerplate still captured, just labelled"
);

// --- html stripping ----------------------------------------------------------
const stripped = htmlToVisibleText(
  `<div><h3>사용방법</h3><p>세안 후 얼굴에 <b>적당량</b>을 펴 바릅니다.</p>` +
    `<script>var x = "사용방법 가짜";</script></div>`
);
assert.ok(!stripped.includes("var x"), "script content removed");
assert.ok(!stripped.includes("<"), "tags removed");
const fromHtml = extractUsageGuidance(stripped);
assert.equal(fromHtml.amountLabel, "적당량", "extraction works on stripped html");
assert.ok(
  fromHtml.methodSteps[0].includes("세안 후 얼굴에"),
  "step text survives stripping"
);

// --- mojibake guard ----------------------------------------------------------
assert.equal(looksMojibake("세안 후 얼굴에 펴 바릅니다."), false, "clean Korean is fine");
assert.equal(looksMojibake(""), false, "empty text is not mojibake");
assert.equal(
  looksMojibake("���� ��, ��Ʈ�� ������ �󱼿� �˸°� �����Ͽ� �ݴϴ�."),
  true,
  "EUC-KR read as UTF-8 is caught"
);

const corrupt = extractUsageGuidance(`
사용방법
���� ��, ��Ʈ�� ������ �󱼿� �˸°� �����Ͽ� �ݴϴ�.
전성분
`);
assert.ok(corrupt.methodSteps.length > 0, "the extractor still finds a section");
assert.equal(
  hasUsableGuidance(corrupt),
  false,
  "but undecodable text is never usable — it must not reach the database"
);

console.log("[usage-guidance-extract] self-test: ok");

// --- placeholders are not guidance -------------------------------------------
const placeholder = extractUsageGuidance(`
사용방법
제품 상세 페이지 참조
전성분
`);
assert.deepEqual(placeholder.methodSteps, [], "pointer text is not a usage step");
assert.equal(hasUsableGuidance(placeholder), false, "placeholder is not usable");

const placeholderSpaced = extractUsageGuidance(`
사용방법
제품 상세페이지 참조
전성분
`);
assert.equal(
  hasUsableGuidance(placeholderSpaced),
  false,
  "spacing variant of the pointer is caught too"
);

// --- the usage section stops where it should ---------------------------------
const manufacturerLeak = extractUsageGuidance(`
사용방법
화장품 제조업자, 화장품 책임판매업자 및 맞춤형 화장품 판매업자
화장품 제조업자 (주)어떤회사
`);
assert.deepEqual(
  manufacturerLeak.methodSteps,
  [],
  "the manufacturer block is not a usage step, spaced spelling included"
);

const cautionLeak = extractUsageGuidance(`
사용방법
젖은 모발에 골고루 바른 다음 원하는 스타일을 만들어 줍니다.
주의사항
속눈썹이나 눈썹에 사용하지 마십시오.
눈에 들어갔을 경우 물로 잘 씻고 전문의의 진료를 받으십시오.
`);
assert.equal(cautionLeak.methodSteps.length, 1, "usage stops at the caution heading");
assert.ok(
  cautionLeak.methodSteps[0].includes("젖은 모발"),
  "only the real instruction is kept"
);
assert.ok(
  !cautionLeak.methodSteps.some((step) => step.includes("속눈썹")),
  "caution sentences never become usage steps"
);
assert.ok(cautionLeak.cautions.length >= 1, "they are captured as cautions instead");

// --- prose with no instruction is not guidance -------------------------------
const prose = extractUsageGuidance(`
사용방법
피부에 수분감을 오래 유지시켜 주는 제품입니다.
전성분
`);
assert.equal(
  hasUsableGuidance(prose),
  false,
  "a description that never tells you to do anything is not guidance"
);

console.log("[usage-guidance-extract] extraction-quality guards: ok");

// --- the palm is not an application area -------------------------------------
const palm = extractUsageGuidance(`
사용방법
손에 적당량을 덜어 얼굴 전체에 부드럽게 펴 발라줍니다.
전성분
`);
assert.deepEqual(
  palm.applicationArea,
  ["얼굴 전체"],
  "dispensing into the palm is not an application area"
);

const handCream = extractUsageGuidance(`
사용방법
적당량을 덜어 손과 손등에 골고루 펴 발라줍니다.
전성분
`);
assert.ok(
  handCream.applicationArea.includes("손"),
  "a product actually applied to the hands still records the hand"
);

console.log("[usage-guidance-extract] area-token guards: ok");

// --- Korean verbs conjugate; the stem alone is not enough --------------------
// Real text from miseenscene.com that an earlier version rejected outright.
const conjugated = extractUsageGuidance(`
사용방법
제1제 염모제 40g에 대하여 제2제 산화제 60g의 비율로 사용 직전에 잘 섞은 후 모발에 균등히 바른다.
30~35분 후에 미지근한 물로 잘 헹군 후 비누나 샴푸로 깨끗이 씻고 마지막에 따뜻한 물로 충분히 헹군다.
전성분
`);
assert.ok(conjugated.methodSteps.length >= 2, "steps captured");
assert.equal(
  hasUsableGuidance(conjugated),
  true,
  "바른다 / 헹군다 are instructions — the dictionary stems 바르 and 헹구 never appear in them"
);

for (const [form, sentence] of [
  ["바른다", "얼굴 전체에 고르게 바른다."],
  ["발라", "손에 덜어 얼굴에 발라 줍니다."],
  ["바릅니다", "적당량을 취해 얼굴에 바릅니다."],
  ["헹군", "미지근한 물로 헹군 뒤 마무리합니다."],
  ["문질러", "거품을 내어 부드럽게 문질러 줍니다."],
  ["두드려", "손끝으로 가볍게 두드려 흡수시킵니다."],
  ["씻고", "깨끗이 씻고 물기를 닦아냅니다."],
  ["섞은", "1제와 2제를 잘 섞은 후 사용합니다."],
] as const) {
  const parsed = extractUsageGuidance(`사용방법\n${sentence}\n전성분\n`);
  assert.equal(
    hasUsableGuidance(parsed),
    true,
    `conjugation "${form}" must read as an instruction`
  );
}

// a description still must not pass
assert.equal(
  hasUsableGuidance(
    extractUsageGuidance("사용방법\n피부를 촉촉하게 가꿔주는 제품입니다.\n전성분\n")
  ),
  false,
  "a claim about the product is still not an instruction"
);

console.log("[usage-guidance-extract] conjugation guards: ok");

// more real sentences that the whitelist missed, from cosrx.com and numbuzin.com
for (const sentence of [
  "세안 후 눈 주위를 피해 피부결을 따라 안쪽에서 바깥으로 닦아줍니다.",
  "After cleansing, spray the toner onto a cotton pad and gently wipe onto face.",
]) {
  assert.equal(
    hasUsableGuidance(extractUsageGuidance(`사용방법\n${sentence}\n전성분\n`)),
    true,
    `must read as an instruction: ${sentence.slice(0, 30)}`
  );
}

console.log("[usage-guidance-extract] observed-verb coverage: ok");
