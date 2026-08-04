/**
 * 성분명 정규화·캐논컬 매칭 (Sprint 3 Phase 2C).
 * normalizeIngredient() 는 결정적(동일 입력 → 동일 출력)이다.
 */

import { toCanonicalIngredientKey } from "./ingredientAliases";

/**
 * 결정적 정규화: NFKC → 소문자 → 숫자/% 제거 → 기호 제거.
 * 한글/가나/한자/라틴만 남긴다.
 */
export function normalizeIngredient(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[%°]/g, " ")
    .replace(/[0-9]+(\.[0-9]+)?%?/g, " ")
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/gi, "")
    .trim();
}

/** @deprecated normalizeIngredient 사용. 기존 import 호환 */
export const normalizeIngredientKey = normalizeIngredient;

/**
 * 성분 토큰에 **딸려 붙은 안내 문구를 잘라낸다.**
 *
 * 국내 화장품 페이지는 전성분 뒤에 규제 안내를 쉼표 없이 이어 붙인다. 그러면
 * 마지막 성분이 안내 문구와 한 덩어리가 되어 정규화·대조가 어긋난다.
 * 2026-08-04 Staging 실측 — 향료 알레르기를 신고해도 이 두 건이 안 걸렀다:
 *
 *   `향료 기능성 화장품 식품의약품안전처 심사필 여부 해당사항 없음 사용할 때의`
 *
 * `향료` 는 목록에 분명히 있는데 토큰 안에 갇혀 있었다. 필터 문제가 아니라
 * **수집 데이터를 쪼갤 때 놓친 것**이다.
 *
 * 여기 담은 표시는 전부 **성분명에는 절대 안 쓰이는 규제·안내 낱말**이다.
 * 성분명 일부일 수 있는 낱말은 넣지 않는다 — 넣으면 진짜 성분이 잘린다.
 */
const KO_NOTICE_MARKERS: ReadonlyArray<RegExp> = [
  /기능성\s*화장품/,
  /식품의약품안전처/,
  /심사필/,
  /해당\s*사항\s*없음/,
  /사용할\s*때의/,
  /사용\s*시\s*주의/,
  /주의\s*사항/,
  /제조\s*번호/,
  /사용\s*기한/,
  /개봉\s*후/,
  /내용량/,
  /품질\s*보증/,
  /소비자\s*상담/,
];

/**
 * 호수·번호별 목록이 이어 붙는 구분자 — `향료 (5번) 정제수`.
 *
 * 끝 표시가 아니라 **구분자**로 다룬다. 여기서 끊어 버리면 뒤쪽 호수의 성분이
 * 통째로 사라지고, 그건 알레르겐을 놓치는 쪽이라 위험하다.
 */
const VARIANT_MARKER = /[([]\s*\d+\s*번\s*[)\]]/g;

/** 안내 문구가 시작되는 지점에서 자른다. 없으면 원문 그대로. */
export function stripIngredientNoticeTail(token: string): string {
  let cut = token.length;
  for (const re of KO_NOTICE_MARKERS) {
    const m = token.match(re);
    if (m?.index != null && m.index < cut) cut = m.index;
  }
  return token.slice(0, cut).trim();
}

function pushToken(out: string[], seen: Set<string>, token: string) {
  const t = token.trim();
  if (!t || seen.has(t)) return;
  seen.add(t);
  out.push(t);
}

function parsePostgresArrayLiteral(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() || parts.length > 0) parts.push(current.trim());
  return parts.map((p) => p.replace(/^"|"$/g, "").trim()).filter(Boolean);
}

function flattenUnknownTokens(
  value: unknown,
  out: string[],
  seen: Set<string>,
  depth = 0
): void {
  if (depth > 4 || value == null) return;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        flattenUnknownTokens(JSON.parse(trimmed), out, seen, depth + 1);
        return;
      } catch {
        // continue
      }
    }

    const pg = parsePostgresArrayLiteral(trimmed);
    if (pg) {
      for (const p of pg) pushToken(out, seen, p);
      return;
    }

    // 호수별 목록이 이어 붙은 것을 먼저 가른다 — `향료 (5번) 정제수`.
    // 여기서 끊지 않고 **쪼갠다**. 끊으면 뒤쪽 호수 성분이 통째로 사라진다.
    const segments = trimmed.split(VARIANT_MARKER);
    if (segments.length > 1) {
      for (const seg of segments) flattenUnknownTokens(seg, out, seen, depth + 1);
      return;
    }

    if (/[,;/|·、]/.test(trimmed)) {
      // **앞뒤가 모두 숫자인 쉼표는 구분자가 아니다** — `1,2-Hexanediol` ·
      // `1,2-헥산다이올` 은 성분명 하나다. 그냥 쪼개면 `1` 이라는 조각이 생기고
      // 나머지가 `2-헥산다이올` 이 되어 사전과 대조가 안 된다.
      for (const part of trimmed.split(/(?<!\d),|,(?!\d)|[;/|·、]+/)) {
        pushToken(out, seen, stripIngredientNoticeTail(part));
      }
      return;
    }

    pushToken(out, seen, stripIngredientNoticeTail(trimmed));
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    pushToken(out, seen, String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) flattenUnknownTokens(item, out, seen, depth + 1);
    return;
  }

  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    for (const key of ["name", "name_en", "name_ko", "name_ja", "label", "value"]) {
      if (typeof rec[key] === "string") {
        flattenUnknownTokens(rec[key], out, seen, depth + 1);
      }
    }
  }
}

export function coerceIngredientList(
  value: string[] | string | null | undefined
): string[] {
  if (value == null) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  flattenUnknownTokens(value, out, seen);
  return out;
}

export function coerceIngredientListUnknown(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  flattenUnknownTokens(value, out, seen);
  return out;
}

/** 라벨 → 캐논컬 키 (동의어 반영, 결정적) */
export function toCanonical(name: string): string {
  return toCanonicalIngredientKey(name, normalizeIngredient);
}

/** 인덱싱된 성분 (원문 라벨 + 캐논컬) — 중복 정규화 방지 */
export type CanonicalIngredientRef = {
  label: string;
  canonical: string;
};

export function indexIngredients(labels: string[]): CanonicalIngredientRef[] {
  const out: CanonicalIngredientRef[] = [];
  const seenCanonical = new Set<string>();
  for (const label of labels) {
    const canonical = toCanonical(label);
    if (!canonical) continue;
    // 동일 캐논컬은 첫 라벨만 대표로 유지 (매칭 결과 표시용)
    if (seenCanonical.has(canonical)) continue;
    seenCanonical.add(canonical);
    out.push({ label, canonical });
  }
  return out;
}

/**
 * 미리 계산된 캐논컬로 매칭 (haystack 은 제품당 1회 인덱싱).
 */
export function findMatchByCanonical(
  needleCanonical: string,
  haystack: CanonicalIngredientRef[]
): string | null {
  if (!needleCanonical) return null;

  for (const item of haystack) {
    if (item.canonical === needleCanonical) return item.label;
  }

  // 짧은 캐논컬 포함 매칭 (오탐 완화: 길이 >= 4)
  for (const item of haystack) {
    const a = needleCanonical;
    const b = item.canonical;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (shorter.length >= 4 && longer.includes(shorter)) {
      return item.label;
    }
  }
  return null;
}

/**
 * 후보 목록에서 needle과 매칭되는 원본 표기.
 * 내부적으로 캐논컬 비교 (호환 API 유지).
 */
export function findMatchingIngredient(
  needle: string,
  haystack: string[]
): string | null {
  const needleCanonical = toCanonical(needle);
  if (!needleCanonical) return null;
  return findMatchByCanonical(needleCanonical, indexIngredients(haystack));
}

export function debugNormalizeIngredients(names: string[]): string[] {
  return names.map((n) => `${n} → ${toCanonical(n)}`);
}
