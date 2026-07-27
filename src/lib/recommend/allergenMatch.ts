import {
  findMatchByCanonical,
  type CanonicalIngredientRef,
} from "./normalizeIngredient";

/**
 * 알레르기·회피 성분 전용 매처.
 *
 * 랭킹이 쓰는 `findMatchByCanonical` 과 **일부러 분리**했다. 랭킹은 짧게 정제된
 * `key_ingredients`(보통 3~9개)를 훑지만, 안전 필터는 전성분(30~160개)을 훑는다.
 * 같은 규칙을 전성분에 그대로 적용하면 오탐이 터진다.
 *
 * 구체적으로 — 기존 규칙은 «짧은 캐논컬이 긴 쪽에 포함되면 매칭» 이다. 캐논컬은
 * 공백을 지우기 때문에 `alcohol` 이 `cetearylalcohol` 에 «포함» 된다. 그래서
 * «변성알코올 알레르기» 를 입력하면 세테아릴알코올·세틸알코올·베헤닐알코올이
 * 전부 걸린다. 이들은 지방 알코올(유화제·에몰리언트)로, 사용자가 피하려는
 * 에탄올과 다른 물질이다. Staging 실측으로 87건 중 20건이 이렇게 잘못 걸렸다.
 *
 * INCI 명명 규칙에서 수식어는 머리명사 **앞** 에 온다:
 *
 *   `Centella Asiatica Extract`  = Centella Asiatica 에서 온 것   → 매칭해야 함
 *   `Cetearyl Alcohol`           = Alcohol 이 아니라 별개 물질     → 매칭하면 안 됨
 *
 * 그래서 포함이 아니라 **접두 관계** 로 본다. needle 이 제품 토큰의 앞부분이거나
 * 그 반대일 때만 같은 계열로 취급하고, 뒤에 붙는 경우는 다른 성분으로 본다.
 */
export function matchAllergenByCanonical(
  needleCanonical: string,
  haystack: CanonicalIngredientRef[]
): string | null {
  if (!needleCanonical) return null;

  for (const item of haystack) {
    if (item.canonical === needleCanonical) return item.label;
  }

  for (const item of haystack) {
    const a = needleCanonical;
    const b = item.canonical;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    // 길이 하한은 기존 매처와 동일 — 3글자 이하 캐논컬의 우연 일치를 막는다.
    if (shorter.length < 4) continue;
    if (longer.startsWith(shorter)) return item.label;
  }

  return null;
}

/**
 * 기존 매처가 잡던 것 중 위 규칙이 놓치는 게 있는지 확인용.
 * 운영 경로에서는 쓰지 않고, 검증 스크립트·자체 검증에서만 쓴다.
 */
export function matchAllergenLegacy(
  needleCanonical: string,
  haystack: CanonicalIngredientRef[]
): string | null {
  return findMatchByCanonical(needleCanonical, haystack);
}
