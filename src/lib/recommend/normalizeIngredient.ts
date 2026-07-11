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

    if (/[,;/|·、]/.test(trimmed)) {
      for (const part of trimmed.split(/[,;/|·、]+/)) pushToken(out, seen, part);
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
