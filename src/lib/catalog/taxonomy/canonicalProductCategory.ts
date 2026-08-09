/**
 * 제품 유형 표기를 **표준 분류(`FACE_SKINCARE_CATEGORIES` 등)로 맞춘다.**
 *
 * ## 왜 필요한가
 *
 * 같은 유형이 표기만 달리해서 여러 값으로 들어와 있다. 2026-08-09 Production
 * 추천 풀 86건 실측 — 유형이 **23종**이었는데, 실제 유형은 그 절반도 안 된다:
 *
 *   serum · Serum          toner · Toner          cream · Cream
 *   mask · Mask            ampoule · Ampoule      SPF · sunscreen
 *   Moisturizer(=cream)    Eye Cream(=eye_cream)  mist(=facial_mist)
 *   facial_oil(=face_oil)  balm(=cleansing_balm)  cleanser(=어느 클렌저?)
 *
 * 지금 당장 추천이 깨지지는 않는다 — 소비하는 쪽이 대부분 소문자로 바꿔 본다.
 * 다만 **표준 분류에 기대는 규칙**(색조 제외 · 선케어 분리 등)은 값이 표준일 때만
 * 동작하고, 화면에도 `Serum` 과 `serum` 이 섞여 나온다.
 *
 * ## 어떻게 매기나
 *
 *   1. 소문자로 바꾸고 공백·하이픈을 밑줄로 모은다 — `Eye Cream` → `eye_cream`
 *   2. 그 값이 표준 목록에 있으면 그대로 쓴다
 *   3. 없으면 **손으로 확인한 별칭표**(`ALIASES`)에서 찾는다
 *   4. 그래도 없으면 **null 을 돌려준다** — 억지로 끼워 맞추지 않는다
 *
 * 4번이 중요하다. 모르는 값을 그럴듯한 유형으로 바꿔 놓으면, 틀렸다는 것조차
 * 드러나지 않는다. `cleanser` 는 어느 클렌저인지 이름만으로는 알 수 없으므로
 * 별칭표에 넣지 않았다 — 그런 건 남겨 두고 사람이 본다.
 */
import {
  FACE_SKINCARE_CATEGORIES,
  LIP_CARE_CATEGORIES,
  SUN_CARE_CATEGORIES,
} from "./domains";

const CANONICAL = new Set<string>([
  ...FACE_SKINCARE_CATEGORIES,
  ...SUN_CARE_CATEGORIES,
  ...LIP_CARE_CATEGORIES,
]);

/** 표기만 다른 것들. **뜻이 확실한 것만** 넣는다. */
const ALIASES: Readonly<Record<string, string>> = {
  // 표기 흔들림
  moisturizer: "cream",
  moisturiser: "cream",
  facial_oil: "face_oil",
  mist: "facial_mist",
  face_mist: "facial_mist",
  spf: "sunscreen",
  sun_screen: "sunscreen",
  suncream: "sun_cream",
  // 마스크 — 어느 마스크인지 이름에 없으면 시트로 보지 않는다.
  // `mask` 는 그래서 별칭표에 없다.
  sleeping_pack: "sleeping_mask",
  wash_off_pack: "wash_off_mask",
  // 클렌징
  cleansing_gel: "gel_cleanser",
  foam_cleansing: "foam_cleanser",
  oil_cleanser: "cleansing_oil",
  balm_cleanser: "cleansing_balm",
  // 눈가
  eye_essence: "eye_serum",
  // 각질
  peeling: "peeling_gel",
  exfoliant: "exfoliator",
};

/** 표기를 다듬은 키 — `Eye Cream` · `eye-cream` · `EYE CREAM` 을 한 모양으로. */
function shapeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * 표준 유형으로 바꾼다. **모르면 null** — 억지로 끼워 맞추지 않는다.
 */
export function canonicalProductCategory(raw: string | null | undefined): string | null {
  const key = shapeKey(String(raw ?? ""));
  if (!key) return null;
  if (CANONICAL.has(key)) return key;
  const alias = ALIASES[key];
  if (alias && CANONICAL.has(alias)) return alias;
  return null;
}

/** 표준 목록에 있는 값인지 (이미 정규화된 값인지 확인할 때). */
export function isCanonicalProductCategory(raw: string | null | undefined): boolean {
  const key = String(raw ?? "").trim();
  return key.length > 0 && CANONICAL.has(key);
}

/**
 * `mask` · `cleanser` 처럼 **덩어리 유형**을, **이름에 근거가 있을 때만** 좁힌다.
 *
 * 표준 분류는 마스크를 시트·수면·모델링·하이드로겔·워시오프로 나누고 클렌저를
 * 폼·젤·오일·밤·워터·밀크·파우더로 나눈다. 그런데 저장된 값은 `mask` · `cleanser`
 * 뿐이라 어느 쪽인지 알 수 없다(2026-08-09 추천 풀 86건 중 25건).
 *
 * **이름이 말해 주면 그대로 따른다.** `약산성 시트 마스크` 는 시트 마스크이고
 * `캐로틴 아크네 폼클렌저` 는 폼 클렌저다. 이건 추측이 아니라 읽는 것이다.
 *
 * 이름이 말해 주지 않으면 **null 을 돌려주고 덩어리 값을 그대로 둔다.**
 * 시트인지 수면팩인지 모르는데 하나로 정해 버리면, 틀렸다는 것조차 드러나지 않는다.
 */
const MASK_HINTS: ReadonlyArray<[RegExp, string]> = [
  [/시트\s*마스크|sheet\s*mask/i, "sheet_mask"],
  [/슬리핑|수면\s*팩|sleeping/i, "sleeping_mask"],
  [/모델링|modeling|modelling/i, "modeling_mask"],
  [/하이드로겔|hydrogel/i, "hydrogel_mask"],
  [/워시\s*오프|wash\s*off/i, "wash_off_mask"],
];

const CLEANSER_HINTS: ReadonlyArray<[RegExp, string]> = [
  [/클렌징\s*오일|cleansing\s*oil/i, "cleansing_oil"],
  [/클렌징\s*밤|cleansing\s*balm/i, "cleansing_balm"],
  [/클렌징\s*워터|cleansing\s*water/i, "cleansing_water"],
  [/클렌징\s*밀크|cleansing\s*milk/i, "cleansing_milk"],
  [/폼\s*클렌저|폼클렌저|foam\s*clean/i, "foam_cleanser"],
  [/젤\s*클렌저|젤클렌저|gel\s*clean/i, "gel_cleanser"],
  [/파우더\s*클렌저|powder\s*clean/i, "powder_cleanser"],
];

const BALM_HINTS: ReadonlyArray<[RegExp, string]> = [
  [/클렌징|cleansing/i, "cleansing_balm"],
  [/립|lip/i, "lip_balm"],
];

export function refineCategoryFromName(
  category: string | null | undefined,
  name: string | null | undefined
): string | null {
  const shaped = shapeKey(String(category ?? ""));
  const text = String(name ?? "");
  if (!shaped || !text) return null;

  const table =
    shaped === "mask" ? MASK_HINTS : shaped === "cleanser" ? CLEANSER_HINTS : shaped === "balm" ? BALM_HINTS : null;
  if (!table) return null;

  for (const [re, to] of table) {
    if (re.test(text) && CANONICAL.has(to)) return to;
  }
  return null;
}
