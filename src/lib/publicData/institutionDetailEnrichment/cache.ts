/**
 * In-memory detail response cache + TTL helpers (T07-03).
 * Never persists secrets. Never writes to Production DB.
 */

import { DETAIL_CACHE_TTL_HOURS } from "./constants";
import type { DetailCacheEntry } from "./types";

export type DetailCacheStore = Map<string, DetailCacheEntry>;

export function createDetailCache(
  seed?: DetailCacheEntry[],
): DetailCacheStore {
  const map: DetailCacheStore = new Map();
  for (const entry of seed ?? []) {
    map.set(entry.institutionId, entry);
  }
  return map;
}

export function isCacheEntryFresh(
  entry: DetailCacheEntry,
  now: Date,
  ttlHours: number = DETAIL_CACHE_TTL_HOURS,
): boolean {
  const fetched = Date.parse(entry.fetchedAt);
  if (!Number.isFinite(fetched)) return false;
  const ageMs = now.getTime() - fetched;
  return ageMs >= 0 && ageMs <= ttlHours * 60 * 60 * 1000;
}

export function getFreshCacheEntry(
  cache: DetailCacheStore,
  institutionId: string,
  now: Date,
): DetailCacheEntry | null {
  const hit = cache.get(institutionId);
  if (!hit) return null;
  return isCacheEntryFresh(hit, now) ? hit : null;
}

export function putCacheEntry(
  cache: DetailCacheStore,
  entry: DetailCacheEntry,
): void {
  cache.set(entry.institutionId, entry);
}

export function snapshotCache(cache: DetailCacheStore): DetailCacheEntry[] {
  return Array.from(cache.values()).sort((a, b) =>
    a.institutionId.localeCompare(b.institutionId),
  );
}
