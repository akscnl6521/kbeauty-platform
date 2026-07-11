/**
 * 성분명 정규화·비교 유틸 (Sprint 3 Phase 2A).
 * - 배열 / JSON 문자열 / 쉼표 구분 / Postgres {a,b} 형식 지원
 * - KO/EN/JA 동의어로 매칭
 */

import {
  expandIngredientMatchKeys,
  toCanonicalIngredientKey,
} from "./ingredientAliases";

/** 비교용 키: NFKC, 소문자, 공백·기호 제거 (한글/가나/한자/라틴 유지) */
export function normalizeIngredientKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[%°]/g, " ")
    .replace(/[0-9]+(\.[0-9]+)?%?/g, " ")
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/gi, "")
    .trim();
}

function pushToken(out: string[], seen: Set<string>, token: string) {
  const t = token.trim();
  if (!t) return;
  if (seen.has(t)) return;
  seen.add(t);
  out.push(t);
}

/** Postgres text[] 리터럴: {a,b,"c d"} */
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
  if (current.trim() || parts.length > 0) {
    parts.push(current.trim());
  }
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

    // JSON 배열/문자열
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        flattenUnknownTokens(parsed, out, seen, depth + 1);
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

    // 쉼표·세미콜론·슬래시·파이프·중점 구분
    if (/[,;/|·、]/.test(trimmed)) {
      for (const part of trimmed.split(/[,;/|·、]+/)) {
        pushToken(out, seen, part);
      }
      return;
    }

    pushToken(out, seen, trimmed);
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    pushToken(out, seen, String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      flattenUnknownTokens(item, out, seen, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    // { name: "Panthenol" } 형태 방어
    const rec = value as Record<string, unknown>;
    for (const key of ["name", "name_en", "name_ko", "name_ja", "label", "value"]) {
      if (typeof rec[key] === "string") {
        flattenUnknownTokens(rec[key], out, seen, depth + 1);
      }
    }
  }
}

/**
 * 제품/추천 성분 필드를 문자열 배열로 통일.
 * string[] | string | JSON | Postgres {} | null 모두 허용.
 */
export function coerceIngredientList(
  value: string[] | string | null | undefined
): string[] {
  if (value == null) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  flattenUnknownTokens(value, out, seen);
  return out;
}

/**
 * unknown 값도 성분 목록으로 (fetch 직후 방어용).
 */
export function coerceIngredientListUnknown(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  flattenUnknownTokens(value, out, seen);
  return out;
}

/**
 * 후보 목록에서 needle과 매칭되는 원본 표기를 찾는다.
 * 동의어(캐논컬 키) 또는 정규화 키 포함 관계로 판정.
 */
export function findMatchingIngredient(
  needle: string,
  haystack: string[]
): string | null {
  const needleKeys = expandIngredientMatchKeys(needle, normalizeIngredientKey);
  if (needleKeys.size === 0) return null;

  const needleCanonical = toCanonicalIngredientKey(
    needle,
    normalizeIngredientKey
  );

  for (const item of haystack) {
    const itemKeys = expandIngredientMatchKeys(item, normalizeIngredientKey);
    if (itemKeys.size === 0) continue;

    // 1) 캐논컬/정규화 키 교집합
    for (const k of needleKeys) {
      if (itemKeys.has(k)) return item;
    }

    const itemCanonical = toCanonicalIngredientKey(
      item,
      normalizeIngredientKey
    );
    if (
      needleCanonical &&
      itemCanonical &&
      needleCanonical === itemCanonical
    ) {
      return item;
    }

    // 2) 포함 매칭 (영문 토큰 등, 최소 길이 가드)
    for (const nk of needleKeys) {
      for (const ik of itemKeys) {
        const shorter = nk.length <= ik.length ? nk : ik;
        const longer = nk.length <= ik.length ? ik : nk;
        if (shorter.length >= 4 && longer.includes(shorter)) {
          return item;
        }
      }
    }
  }
  return null;
}

/** 디버그용: 성분 목록의 정규화·캐논컬 키 */
export function debugNormalizeIngredients(names: string[]): string[] {
  return names.map(
    (n) =>
      `${n} → ${toCanonicalIngredientKey(n, normalizeIngredientKey) || normalizeIngredientKey(n)}`
  );
}
